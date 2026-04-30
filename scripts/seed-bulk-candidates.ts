/**
 * Bulk seeds 60 candidates that all pass the viewer's hard filters
 * (female / 20~35 / KR·JP·US / primary != ko) so a single test session
 * can hit the MAX_PER_DAY=50 daily cap.
 *
 * 주 언어 하드 필터 도입(`languages->0->>code <> viewer.language`)으로
 * primary='ko' 후보는 viewer(가정 primary='ko') 시점에 자동 제외되므로
 * LANGUAGE_PROFILES 에서 ko-primary 항목을 제거함.
 *
 * Usage:
 *   npx tsx scripts/seed-bulk-candidates.ts          # create
 *   npx tsx scripts/seed-bulk-candidates.ts --clean  # remove
 *
 * Tagged with app_metadata.tag = 'discover-bulk-seed' so cleanup is precise
 * and won't touch the original `seed-test-candidates.ts` set.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const TAG = 'discover-bulk-seed';
const COUNT = 60;
const PHOTO_STUB = 'https://placehold.co/600x800.jpg';

const NATIONALITIES = ['KR', 'JP', 'US'] as const;
const LANGUAGE_PROFILES = [
  // viewer primary='ko' 가정. primary='ko' 후보는 사전 필터에서 하드 제외되므로
  // 여기서는 모두 non-ko primary 로 채워 일일 한도 검증 표본을 확보한다.
  [{ code: 'en', level: 3 as const }, { code: 'ko', level: 1 as const }], // T1 (선호 부합)
  [{ code: 'ja', level: 3 as const }, { code: 'en', level: 2 as const }], // T1 (선호 부합)
  [{ code: 'en', level: 3 as const }, { code: 'ja', level: 1 as const }], // T1 (선호 부합)
  [{ code: 'zh', level: 3 as const }],                                    // T2 (언어 미부합)
];

const INTEREST_POOL = [
  'music', 'travel', 'coffee', 'movies', 'food', 'reading',
  'gaming', 'cooking', 'photography', 'hiking',
];

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const birthYearsAgo = (n: number) => {
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

function pickInterests(seed: number): string[] {
  // 0~4개, 결정적이지만 분포 다양
  const n = seed % 5;
  const start = (seed * 3) % INTEREST_POOL.length;
  return Array.from({ length: n }, (_, i) => INTEREST_POOL[(start + i) % INTEREST_POOL.length]);
}

async function clean() {
  const { data: pages } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const targets = (pages?.users ?? []).filter(
    (u) => (u.app_metadata as any)?.tag === TAG,
  );
  console.log(`Cleaning ${targets.length} bulk-seeded users...`);
  for (const u of targets) {
    await supabase.auth.admin.deleteUser(u.id);
  }
  console.log('Done.');
}

async function seed() {
  console.log(`Seeding ${COUNT} bulk candidates (all pass viewer's hard filter)...`);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < COUNT; i++) {
    const email = `bulk-seed-${String(i).padStart(3, '0')}@test.local`;
    const age = 20 + (i % 16); // 20~35세
    const nationality = NATIONALITIES[i % NATIONALITIES.length];
    const languages = LANGUAGE_PROFILES[i % LANGUAGE_PROFILES.length];
    const photoCount = (i % 4) + 1; // 1~4장
    const photos = Array.from({ length: photoCount }, () => PHOTO_STUB);
    const createdDaysAgo = i % 14; // 0~13일 전 (7일 보너스 분포)

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: 'TestPassword!123',
      email_confirm: true,
      app_metadata: { tag: TAG },
    });
    if (createErr || !created.user) {
      console.error(`✗ ${email}: ${createErr?.message}`);
      fail++;
      continue;
    }

    const { error: profErr } = await supabase.from('profiles').insert({
      id: created.user.id,
      display_name: `벌크_${String(i).padStart(3, '0')}`,
      birth_date: birthYearsAgo(age),
      gender: 'female', // 모두 viewer 선호 통과
      nationality,
      languages,
      voice_intro: `안녕하세요, ${i}번째 테스트 유저예요.`,
      interests: pickInterests(i),
      photos,
      voice_clone_status: 'ready',
      is_active: true,
      created_at: daysAgo(createdDaysAgo),
    });
    if (profErr) {
      console.error(`✗ profile ${email}: ${profErr.message}`);
      fail++;
      continue;
    }
    ok++;
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${COUNT}`);
  }

  console.log(`\nDone. success=${ok}, fail=${fail}`);
  console.log('Cleanup: npx tsx scripts/seed-bulk-candidates.ts --clean');
}

const cmd = process.argv[2];
(cmd === '--clean' ? clean() : seed()).catch((e) => {
  console.error(e);
  process.exit(1);
});
