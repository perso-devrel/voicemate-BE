-- Rename `bio` → `voice_intro` to match the "보이스 한마디" UI branding.
-- The TTS pipeline still synthesizes the text into audio and stores the
-- public URL in voice_intro_audio_url; only the column/bucket names changed.

ALTER TABLE public.profiles
  RENAME COLUMN bio TO voice_intro;

ALTER TABLE public.profiles
  RENAME COLUMN bio_audio_url TO voice_intro_audio_url;

-- Existing URLs still reference the legacy `bio-audio` bucket. Null them so
-- the TTS pipeline regenerates audio with the new bucket on the next save.
UPDATE public.profiles
SET voice_intro_audio_url = NULL
WHERE voice_intro_audio_url IS NOT NULL;

-- Create the new storage bucket. The legacy `bio-audio` bucket and its
-- objects must be removed via the Storage API (Supabase blocks direct
-- DELETE on storage tables) — see scripts/cleanup-bio-audio-bucket.ts.
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-intro-audio', 'voice-intro-audio', true)
ON CONFLICT (id) DO NOTHING;
