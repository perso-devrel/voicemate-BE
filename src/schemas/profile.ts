import { z } from 'zod';

export const profileUpsertSchema = z.object({
  display_name: z.string().min(1).max(50),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['male', 'female', 'other']),
  nationality: z.string().min(2).max(5),
  language: z.string().min(2).max(5),
  bio: z.string().max(500).nullable().optional(),
  interests: z.array(z.string().max(30)).max(10).optional(),
});
