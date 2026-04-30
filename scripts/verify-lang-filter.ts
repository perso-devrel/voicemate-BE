/**
 * Verifies the primary-language hard filter on /api/discover candidates.
 *
 * Reproduces the candidate SELECT in `swipe.ts` (`languages->0->>code <> viewer_lang`)
 * via the Supabase service role and inspects whether the ko-primary seeds
 * (시드_언어필터_A/B) are excluded.
 *
 * Usage:
 *   npx tsx scripts/verify-lang-filter.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const VIEWER_LANG = 'ko';

async function main() {
  // 1) 시드된 'discover-seed' 태그 유저들의 id 모음 (검증 범위 한정용)
  const { data: pages } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const seedUsers = (pages?.users ?? []).filter(
    (u) => (u.app_metadata as any)?.tag === 'discover-seed',
  );
  if (seedUsers.length === 0) {
    console.error('seed users not found. run `npx tsx scripts/seed-test-candidates.ts` first.');
    process.exit(1);
  }
  const seedIds = seedUsers.map((u) => u.id);

  // 2) 필터 미적용 풀 (시드 한정)
  const { data: unfiltered, error: e1 } = await supabase
    .from('profiles')
    .select('id, display_name, languages, is_active')
    .in('id', seedIds);
  if (e1) throw e1;

  // 3) swipe.ts 와 동일한 하드 필터 적용 (`is_active=true` + 주언어 != viewer)
  const { data: filtered, error: e2 } = await supabase
    .from('profiles')
    .select('id, display_name, languages, is_active')
    .in('id', seedIds)
    .eq('is_active', true)
    .not('languages->0->>code', 'eq', VIEWER_LANG);
  if (e2) throw e2;

  const filteredNames = new Set((filtered ?? []).map((r) => r.display_name));

  console.log(`Viewer primary language: ${VIEWER_LANG}`);
  console.log(`전체 시드(${unfiltered?.length}개) → 필터 후(${filtered?.length}개)\n`);

  console.log('| 후보 | primary lang | active | 필터 통과? | 기대값 |');
  console.log('|------|--------------|--------|-----------|--------|');

  let pass = 0;
  let fail = 0;
  for (const row of unfiltered ?? []) {
    const langs = (row.languages as { code: string; level: number }[] | null) ?? [];
    const primary = langs[0]?.code ?? '(none)';
    const passed = filteredNames.has(row.display_name);

    // 기대값: ko-primary 또는 inactive → 사전 필터에서 제외
    const shouldPass = primary !== VIEWER_LANG && row.is_active;
    const ok = passed === shouldPass;
    if (ok) pass++; else fail++;

    console.log(
      `| ${row.display_name} | ${primary} | ${row.is_active} | ${passed ? 'YES' : 'NO '} | ${shouldPass ? 'YES' : 'NO '} | ${ok ? 'OK' : 'MISMATCH'}`,
    );
  }

  console.log(`\nResult: ${pass} pass, ${fail} mismatch`);

  // ko-primary 시드 명시 확인
  const koSeeds = (unfiltered ?? []).filter((r) => {
    const langs = (r.languages as { code: string; level: number }[] | null) ?? [];
    return langs[0]?.code === VIEWER_LANG;
  });
  const koLeaked = koSeeds.filter((r) => filteredNames.has(r.display_name));
  console.log(`\nko-primary 시드 ${koSeeds.length}개 중 필터 누수: ${koLeaked.length}개`);
  if (koLeaked.length > 0) {
    console.log('  누수 후보:', koLeaked.map((r) => r.display_name));
    process.exit(1);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
