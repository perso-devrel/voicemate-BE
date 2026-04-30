/**
 * Verifies migration 008 (drop language/preferred_languages, add preferred_nationalities).
 * Read-only — does not mutate. Run via: npx tsx scripts/check-mig008.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function probe(table: string, column: string): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (error) {
    console.log(`  ${table}.${column}: ABSENT — ${error.message.split('\n')[0]}`);
    return false;
  }
  console.log(`  ${table}.${column}: present`);
  return true;
}

async function main() {
  console.log('Probing schema state:');
  const profilesLanguage = await probe('profiles', 'language');
  const profilesLanguages = await probe('profiles', 'languages');
  const prefsOldLangs = await probe('user_preferences', 'preferred_languages');
  const prefsLangsDetail = await probe('user_preferences', 'preferred_languages_detail');
  const prefsNats = await probe('user_preferences', 'preferred_nationalities');

  const ok =
    !profilesLanguage &&
    profilesLanguages &&
    !prefsOldLangs &&
    prefsLangsDetail &&
    prefsNats;

  if (ok) {
    console.log('\n✓ Migration 008 applied — schema is up to date.');
  } else {
    console.log('\n✗ Migration 008 NOT fully applied.');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
