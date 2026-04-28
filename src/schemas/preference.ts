import { z } from 'zod';
import { languageProficiencySchema } from './profile';

export const preferenceSchema = z.object({
  min_age: z.number().int().min(18).max(100).optional().default(18),
  max_age: z.number().int().min(18).max(100).optional().default(100),
  preferred_genders: z.array(z.enum(['male', 'female', 'other'])).optional().default(['male', 'female', 'other']),
  // Legacy: codes-only filter, kept in lock-step with preferred_languages_detail
  // server-side so the discover query (which `IN (...)` filters on these codes)
  // continues to work without a join into the JSONB column.
  preferred_languages: z.array(z.string().min(2).max(5)).optional().default([]),
  // New: codes + minimum required level. When supplied, the route derives
  // preferred_languages from this list and overwrites the legacy column.
  preferred_languages_detail: z.array(languageProficiencySchema).optional().default([]),
}).refine((data) => data.min_age <= data.max_age, {
  message: 'min_age must be less than or equal to max_age',
  path: ['min_age'],
});
