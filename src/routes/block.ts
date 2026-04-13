import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { blockSchema } from '../schemas/block';
import { AuthRequest } from '../types';

const router = Router();

router.use(authMiddleware);

// 차단
router.post('/', validateBody(blockSchema), async (req: AuthRequest, res: Response) => {
  const { blocked_id } = req.body;

  if (blocked_id === req.userId) {
    res.status(400).json({ error: 'Cannot block yourself' });
    return;
  }

  const { error } = await supabase.from('blocks').insert({
    blocker_id: req.userId!,
    blocked_id,
  });

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Already blocked' });
      return;
    }
    res.status(500).json({ error: error.message });
    return;
  }

  // 기존 매치가 있으면 soft delete
  const [id1, id2] = [req.userId!, blocked_id].sort();
  await supabase
    .from('matches')
    .update({ unmatched_at: new Date().toISOString(), unmatched_by: req.userId! })
    .eq('user1_id', id1)
    .eq('user2_id', id2)
    .is('unmatched_at', null);

  res.status(201).json({ status: 'blocked' });
});

// 차단 해제
router.delete('/:blockedId', async (req: AuthRequest, res: Response) => {
  const { blockedId } = req.params;

  const { error, count } = await supabase
    .from('blocks')
    .delete({ count: 'exact' })
    .eq('blocker_id', req.userId!)
    .eq('blocked_id', blockedId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (count === 0) {
    res.status(404).json({ error: 'Block not found' });
    return;
  }

  res.json({ status: 'unblocked' });
});

// 차단 목록
router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, created_at, profile:profiles!blocked_id(id, display_name, photos)')
    .eq('blocker_id', req.userId!)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

export default router;
