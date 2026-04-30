import { z } from 'zod';

// 1 = beginner, 2 = intermediate (daily conversation),
// 3 = native (fluent / unrestricted conversation).
export const languageProficiencySchema = z.object({
  code: z.string().min(2).max(5),
  level: z.number().int().min(1).max(3),
});

export const profileUpsertSchema = z.object({
  display_name: z.string().min(1).max(50),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['male', 'female', 'other']),
  nationality: z.string().min(2).max(5),
  // Legacy primary language (used by the translation/TTS pipeline). Optional
  // when `languages[]` is supplied — the route derives it from languages[0].
  language: z.string().min(2).max(5).optional(),
  // Multi-language with proficiency. When present, languages[0] becomes the
  // primary `language`. Required to be non-empty if provided.
  languages: z.array(languageProficiencySchema).min(1).max(10).optional(),
  voice_intro: z.string().max(500).nullable().optional(),
  interests: z.array(z.string().max(30)).max(10).optional(),
}).refine((data) => data.language || (data.languages && data.languages.length > 0), {
  message: 'Either language or languages must be provided',
  path: ['language'],
});
