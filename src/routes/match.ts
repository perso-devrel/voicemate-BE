import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { AuthRequest } from '../types';

const matchListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  before: z.string().datetime().optional(),
});

interface MatchSummary {
  match_id: string;
  last_message_id: string | null;
  last_message_text: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: string | null;
  unread_count: number;
}

const router = Router();

router.use(authMiddleware);

// 내 매치 목록 (상대 프로필 + 마지막 메시지 + 읽지 않은 수)
router.get('/', validateQuery(matchListQuerySchema), async (req: AuthRequest, res: Response) => {
  const limit = req.query.limit as unknown as number;
  const before = req.query.before as string | undefined;

  // 1. 매치 조회 (unmatched 제외)
  let matchQuery = supabase
    .from('matches')
    .select('*')
    .or(`user1_id.eq.${req.userId!},user2_id.eq.${req.userId!}`)
    .is('unmatched_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    matchQuery = matchQuery.lt('created_at', before);
  }

  const { data: matches, error } = await matchQuery;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!matches || matches.length === 0) {
    res.json([]);
    return;
  }

  // 2. Partner 프로필 배치 조회
  const partnerIds = matches.map((m) =>
    m.user1_id === req.userId! ? m.user2_id : m.user1_id
  );

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, photos, nationality, language')
    .in('id', partnerIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // 3. 매치별 마지막 메시지 + 읽지 않은 수 (RPC)
  const matchIds = matches.map((m) => m.id);
  const { data: summaries } = await supabase.rpc('get_match_summaries', {
    match_ids: matchIds,
    viewer_id: req.userId!,
  });

  const summaryMap = new Map<string, MatchSummary>(
    ((summaries || []) as MatchSummary[]).map((s) => [s.match_id, s])
  );

  // 4. 조합
  const results = matches.map((match) => {
    const partnerId = match.user1_id === req.userId! ? match.user2_id : match.user1_id;
    const summary = summaryMap.get(match.id);

    return {
      match_id: match.id,
      created_at: match.created_at,
      partner: profileMap.get(partnerId) || null,
      last_message: summary?.last_message_id
        ? {
            id: summary.last_message_id,
            original_text: summary.last_message_text,
            sender_id: summary.last_message_sender_id,
            created_at: summary.last_message_created_at,
          }
        : null,
      unread_count: Number(summary?.unread_count || 0),
    };
  });

  res.json(results);
});

// 언매치 (soft delete)
router.delete('/:matchId', async (req: AuthRequest, res: Response) => {
  const { matchId } = req.params;

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .or(`user1_id.eq.${req.userId!},user2_id.eq.${req.userId!}`)
    .is('unmatched_at', null)
    .single();

  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  const { error } = await supabase
    .from('matches')
    .update({
      unmatched_at: new Date().toISOString(),
      unmatched_by: req.userId!,
    })
    .eq('id', matchId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ status: 'unmatched' });
});

export default router;
