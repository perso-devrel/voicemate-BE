/**
 * Verifies whether migration 007 (bio → voice_intro rename) has been applied.
 * Read-only — does not mutate anything. Run via: npx tsx scripts/check-voice-intro-rename.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function probe(column: string): Promise<boolean> {
  const { error } = await supabase.from('profiles').select(column).limit(1);
  if (error) {
    console.log(`  ${column}: ERROR — ${error.message}`);
    return false;
  }
  console.log(`  ${column}: present`);
  return true;
}

async function main() {
  console.log('Probing profiles columns:');
  const hasVoiceIntro = await probe('voice_intro');
  const hasVoiceIntroAudio = await probe('voice_intro_audio_url');
  const hasOldBio = await probe('bio');
  const hasOldBioAudio = await probe('bio_audio_url');

  if (hasVoiceIntro && hasVoiceIntroAudio && !hasOldBio && !hasOldBioAudio) {
    console.log('\n✓ Migration 007 already applied — schema is up to date.');
  } else if (!hasVoiceIntro && hasOldBio) {
    console.log('\n✗ Migration 007 NOT applied — old `bio` columns still present.');
    process.exit(2);
  } else {
    console.log('\n? Schema is in an unexpected partial state.');
    process.exit(3);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
