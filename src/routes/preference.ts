import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { preferenceSchema } from '../schemas/preference';
import { AuthRequest } from '../types';

const router = Router();

router.use(authMiddleware);

// 선호도 조회
router.get('/', async (req: AuthRequest, res: Response) => {
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', req.userId!)
    .single();

  // 없으면 기본값 반환
  res.json(data || {
    user_id: req.userId,
    min_age: 18,
    max_age: 100,
    preferred_genders: ['male', 'female', 'other'],
    preferred_languages: [],
    preferred_languages_detail: [],
  });
});

// 선호도 설정 (upsert)
router.put('/', validateBody(preferenceSchema), async (req: AuthRequest, res: Response) => {
  const { min_age, max_age, preferred_genders, preferred_languages, preferred_languages_detail } = req.body;

  // 다중 언어/레벨 입력이 들어오면 코드 배열을 그것에서 도출하여 두 컬럼을 동기화한다.
  // (discover 의 swipe.ts 는 여전히 preferred_languages TEXT[] 만 IN-필터에 사용한다.)
  const detail = Array.isArray(preferred_languages_detail) ? preferred_languages_detail : [];
  const codes = detail.length > 0
    ? detail.map((d: { code: string }) => d.code)
    : (preferred_languages ?? []);

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: req.userId!,
      min_age,
      max_age,
      preferred_genders,
      preferred_languages: codes,
      preferred_languages_detail: detail,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json(data);
});

export default router;
