-- Adds emotion column to messages for ElevenLabs v3 emotional TTS.
-- See src/routes/message.ts and src/services/elevenlabs.ts.

alter table public.messages
  add column emotion text
    check (emotion in ('happy', 'sad', 'angry', 'surprised', 'excited', 'whispering', 'laughing'));
