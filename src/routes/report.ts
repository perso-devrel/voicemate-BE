import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { reportSchema } from '../schemas/report';
import { AuthRequest } from '../types';

const router = Router();

router.use(authMiddleware);

// 신고
router.post('/', validateBody(reportSchema), async (req: AuthRequest, res: Response) => {
  const { reported_id, reason, description } = req.body;

  if (reported_id === req.userId) {
    res.status(400).json({ error: 'Cannot report yourself' });
    return;
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: req.userId!,
    reported_id,
    reason,
    description,
  });

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Already reported this user' });
      return;
    }
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ status: 'reported' });
});

export default router;
