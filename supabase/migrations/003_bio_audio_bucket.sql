-- Creates the `bio-audio` storage bucket used by generateBioAudio() in
-- src/routes/profile.ts. ElevenLabs synthesizes the user's bio text into an
-- mp3, we upload it here, and the public URL is written to
-- profiles.bio_audio_url so the FE can play it without a signed URL.
--
-- Safe to re-run: ON CONFLICT clause makes this idempotent.

insert into storage.buckets (id, name, public)
values ('bio-audio', 'bio-audio', true)
on conflict (id) do nothing;
