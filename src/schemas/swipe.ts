import { z } from 'zod';

export const swipeBodySchema = z.object({
  swiped_id: z.string().uuid(),
  direction: z.enum(['like', 'pass']),
});

export const discoverQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
