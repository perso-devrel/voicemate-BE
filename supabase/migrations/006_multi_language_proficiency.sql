-- Multi-language proficiency support.
--
-- Adds JSONB columns that carry one entry per language with a level
-- (1 = beginner, 2 = intermediate, 3 = native). The legacy scalar
-- `profiles.language` and `user_preferences.preferred_languages` columns
-- remain the source of truth for the translation pipeline and discover
-- filter respectively, so no downstream code needs to change yet:
--   * profiles.language        = languages[0].code (primary language)
--   * preferred_languages      = preferred_languages_detail[].code
-- The API layer keeps both representations in sync on every PUT.

-- profiles.languages: [{code: "ko", level: 3}, ...]
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS languages JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill from existing scalar column (assume native level for the
-- legacy single language so existing users aren't downgraded).
UPDATE public.profiles
SET languages = jsonb_build_array(
  jsonb_build_object('code', language, 'level', 3)
)
WHERE languages = '[]'::jsonb AND language IS NOT NULL;

-- user_preferences.preferred_languages_detail: [{code, level}, ...]
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS preferred_languages_detail JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill from existing TEXT[] column. Level 1 = beginner is the most
-- inclusive default so existing prefs don't suddenly filter people out.
UPDATE public.user_preferences
SET preferred_languages_detail = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('code', code_value, 'level', 1))
    FROM unnest(preferred_languages) AS code_value
  ),
  '[]'::jsonb
)
WHERE preferred_languages_detail = '[]'::jsonb
  AND preferred_languages IS NOT NULL
  AND array_length(preferred_languages, 1) > 0;
