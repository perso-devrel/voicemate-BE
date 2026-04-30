-- 1) profiles: drop redundant scalar `language` column.
--    `languages` (JSONB, [{code, level}]) is now the single source of truth.
--    Backfill any rows where languages was left empty so we don't lose the
--    primary language during the column drop.
UPDATE public.profiles
SET languages = jsonb_build_array(jsonb_build_object('code', language, 'level', 3))
WHERE jsonb_array_length(languages) = 0
  AND language IS NOT NULL;

ALTER TABLE public.profiles
  DROP COLUMN language;

-- 2) user_preferences: drop redundant codes-only mirror (was kept in lock-step
--    with preferred_languages_detail purely for legacy discover SQL filter,
--    which has since moved to a soft tier signal).
ALTER TABLE public.user_preferences
  DROP COLUMN preferred_languages;

-- 3) user_preferences: add country preference column (FE has been sending
--    `preferred_nationalities` for a while; until now the BE silently
--    dropped it, so saved selections never persisted).
ALTER TABLE public.user_preferences
  ADD COLUMN preferred_nationalities TEXT[] NOT NULL DEFAULT '{}';
