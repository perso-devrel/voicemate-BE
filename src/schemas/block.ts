import { z } from 'zod';

export const blockSchema = z.object({
  blocked_id: z.string().uuid(),
});
