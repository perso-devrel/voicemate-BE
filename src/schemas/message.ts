import { z } from 'zod';

export const emotionSchema = z.enum([
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'excited',
  'whispering',
  'laughing',
]);

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  emotion: emotionSchema.optional(),
});

export const messageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  before: z.string().datetime().optional(),
});
