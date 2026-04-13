import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { swipeBodySchema, discoverQuerySchema } from '../schemas/swipe';
import { AuthRequest } from '../types';

const router = Router();

router.use(authMiddleware);

// 결정적 해시 기반 jitter (같은 viewer-candidate 쌍에 대해 동일 값 반환)
function hashJitter(candidateId: string, viewerId: string, max: number): number {
  let hash = 0;
  const str = candidateId + viewerId;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % (max * 100)) / 100;
}

// 추천 점수 계산
function computeScore(
  candidate: {
    id: string;
    language: string;
    interests: string[];
    voice_clone_status: string;
    photos: string[];
    bio: string | null;
    created_at: string;
  },
  viewer: { id: string; language: string; interests: string[] }
): number {
  let score = 0;

  // 다른 언어 사용자 우선 (앱 핵심 가치)
  if (candidate.language !== viewer.language) {
    score += 30;
  }

  // 관심사 겹침 (최대 30점)
  const viewerInterests = new Set(viewer.interests);
  const overlap = candidate.interests.filter((i) => viewerInterests.has(i)).length;
  score += Math.min(overlap * 10, 30);

  // voice clone ready → 더빙 체험 가능
  if (candidate.voice_clone_status === 'ready') {
    score += 15;
  }

  // 프로필 완성도
  if (candidate.photos.length >= 3) {
    score += 10;
  }
  if (candidate.bio) {
    score += 5;
  }

  // 신규 유저 부스트 (7일 이내)
  const daysSinceCreated = (Date.now() - new Date(candidate.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated <= 7) {
    score += 10;
  }

  // 결정적 jitter (다양성 확보, 페이지네이션 안정성)
  score += hashJitter(candidate.id, viewer.id, 15);

  return score;
}

// 매칭 후보 목록 (추천 알고리즘 적용)
router.get('/', validateQuery(discoverQuerySchema), async (req: AuthRequest, res: Response) => {
  const limit = req.query.limit as unknown as number;

  // 조회자 프로필
  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('language, interests')
    .eq('id', req.userId!)
    .single();

  if (!viewerProfile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const viewer = { id: req.userId!, ...viewerProfile };

  // 스와이프/차단/선호도를 병렬 조회
  const [swipedResult, blockedResult, prefsResult] = await Promise.all([
    supabase.from('swipes').select('swiped_id').eq('swiper_id', req.userId!),
    supabase.from('blocks').select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${req.userId!},blocked_id.eq.${req.userId!}`),
    supabase.from('user_preferences').select('*').eq('user_id', req.userId!).single(),
  ]);

  const blockedIds = (blockedResult.data || []).map((b: any) =>
    b.blocker_id === req.userId! ? b.blocked_id : b.blocker_id
  );

  const excludeIds = [
    req.userId!,
    ...(swipedResult.data?.map((s: any) => s.swiped_id) || []),
    ...blockedIds,
  ];
  const uniqueExcludeIds = [...new Set(excludeIds)];

  const prefs = prefsResult.data;

  // 점수 계산을 위해 넉넉히 가져옴 (limit의 5배, 최대 200)
  const fetchLimit = Math.min(limit * 5, 200);

  let query = supabase
    .from('profiles')
    .select('id, display_name, birth_date, gender, nationality, language, bio, interests, photos, voice_clone_status, created_at')
    .eq('is_active', true);

  if (uniqueExcludeIds.length > 0) {
    query = query.not('id', 'in', `(${uniqueExcludeIds.join(',')})`);
  }

  query = query.limit(fetchLimit);

  // 선호도 필터 적용
  if (prefs) {
    if (prefs.preferred_genders && prefs.preferred_genders.length > 0) {
      query = query.in('gender', prefs.preferred_genders);
    }
    if (prefs.preferred_languages && prefs.preferred_languages.length > 0) {
      query = query.in('language', prefs.preferred_languages);
    }
    const now = new Date();
    if (prefs.min_age) {
      const maxBirthDate = new Date(now.getFullYear() - prefs.min_age, now.getMonth(), now.getDate())
        .toISOString().split('T')[0];
      query = query.lte('birth_date', maxBirthDate);
    }
    if (prefs.max_age) {
      const minBirthDate = new Date(now.getFullYear() - prefs.max_age - 1, now.getMonth(), now.getDate())
        .toISOString().split('T')[0];
      query = query.gte('birth_date', minBirthDate);
    }
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // 점수 계산 → 정렬 → limit 개수만큼 반환
  const scored = (data || []).map((candidate) => ({
    ...candidate,
    _score: computeScore(candidate, viewer),
  }));

  scored.sort((a, b) => b._score - a._score);

  // 프론트에 반환할 때 score, voice_clone_status, created_at 제외
  const results = scored.slice(0, limit).map(({ _score, voice_clone_status, created_at, ...rest }) => rest);

  res.json(results);
});

// 스와이프
router.post('/swipe', validateBody(swipeBodySchema), async (req: AuthRequest, res: Response) => {
  const { swiped_id, direction } = req.body;

  const { error: swipeError } = await supabase.from('swipes').insert({
    swiper_id: req.userId!,
    swiped_id,
    direction,
  });

  if (swipeError) {
    if (swipeError.code === '23505') {
      res.status(409).json({ error: 'Already swiped this user' });
      return;
    }
    res.status(500).json({ error: swipeError.message });
    return;
  }

  let match = null;
  if (direction === 'like') {
    const { data: reciprocal } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', swiped_id)
      .eq('swiped_id', req.userId!)
      .eq('direction', 'like')
      .single();

    if (reciprocal) {
      const [user1, user2] = [req.userId!, swiped_id].sort();
      const { data: newMatch, error: matchError } = await supabase
        .from('matches')
        .insert({ user1_id: user1, user2_id: user2 })
        .select()
        .single();

      if (matchError?.code === '23505') {
        // 동시 like로 인한 중복 — 기존 매치 조회
        const { data: existing } = await supabase
          .from('matches')
          .select()
          .eq('user1_id', user1)
          .eq('user2_id', user2)
          .single();
        match = existing;
      } else if (!matchError) {
        match = newMatch;
      }
    }
  }

  res.json({ direction, match });
});

export default router;
