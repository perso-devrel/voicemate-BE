/**
 * Seeds test candidate users into Supabase for /api/discover testing.
 * Creates auth users + profiles with varied tier/score signals.
 *
 * Viewer 가정 (테스트 시 본인 프로필 + user_preferences):
 *   - profiles.languages[0].code = 'ko'  (primary language)
 *   - preferred_genders = ['female']
 *   - preferred_languages_detail = [{ code: 'en', level: 2 }]
 *   - preferred_nationalities = ['KR', 'JP', 'US']
 *   - min_age = 20, max_age = 35
 *
 * Usage:
 *   npx tsx scripts/seed-test-candidates.ts          # create
 *   npx tsx scripts/seed-test-candidates.ts --clean  # remove previously seeded test users
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (service role bypasses RLS).
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const TAG = 'discover-seed'; // app_metadata 태그로 시드 유저만 골라 정리할 수 있게

type Lang = { code: string; level: 1 | 2 | 3 };
type Seed = {
  email: string;
  display_name: string;
  birth_date: string; // YYYY-MM-DD
  gender: 'male' | 'female' | 'other';
  nationality: string;
  languages: Lang[];
  voice_intro: string;
  interests: string[];
  photos: string[]; // 길이만 의미 있음
  created_days_ago: number;
  /** discover 응답에 노출돼야 하는지에 대한 기대값 (테스트 검증용 메타) */
  expect_visible: boolean;
  expect_reason: string;
};

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

const PHOTO_STUB = 'https://placehold.co/600x800.jpg';

const seeds: Seed[] = [
  // ─── T1: 선호 부합 (primary != ko) ────────────────────────────────────────
  {
    email: 'seed-t1-a@test.local',
    display_name: '시드_T1_A',
    birth_date: birthYearsAgo(28),
    gender: 'female',
    nationality: 'US',
    languages: [{ code: 'en', level: 3 }, { code: 'ko', level: 1 }],
    voice_intro: '안녕하세요, 새로운 사람을 만나는 걸 좋아해요.',
    interests: ['music', 'travel', 'coffee'],
    photos: [PHOTO_STUB, PHOTO_STUB, PHOTO_STUB],
    created_days_ago: 2,
    expect_visible: true,
    expect_reason: 'T1 — 선호 부합 (en lv3, US), 주언어 다름',
  },
  {
    email: 'seed-t1-b@test.local',
    display_name: '시드_T1_B',
    birth_date: birthYearsAgo(30),
    gender: 'female',
    nationality: 'JP',
    languages: [{ code: 'ja', level: 3 }, { code: 'en', level: 3 }],
    voice_intro: 'はじめまして、よろしくお願いします。',
    interests: ['music'],
    photos: [PHOTO_STUB],
    created_days_ago: 20,
    expect_visible: true,
    expect_reason: 'T1 — 선호 부합 (en lv3, JP), 주언어=ja',
  },

  // ─── T2: 선호 미부합 (primary != ko) ──────────────────────────────────────
  {
    email: 'seed-t2-a@test.local',
    display_name: '시드_T2_A',
    birth_date: birthYearsAgo(29),
    gender: 'female',
    nationality: 'CN', // 선호 국가에 없음 → 선호 미부합
    languages: [{ code: 'zh', level: 3 }],
    voice_intro: '你好，很高兴认识你。',
    interests: ['movies', 'food'],
    photos: [PHOTO_STUB, PHOTO_STUB, PHOTO_STUB],
    created_days_ago: 4,
    expect_visible: true,
    expect_reason: 'T2 — 국가 미부합(CN), 주언어=zh',
  },
  {
    email: 'seed-t2-b@test.local',
    display_name: '시드_T2_B',
    birth_date: birthYearsAgo(31),
    gender: 'female',
    nationality: 'VN',
    languages: [{ code: 'vi', level: 3 }, { code: 'en', level: 1 }], // en lv1 < 요구 lv2 → 언어 미부합
    voice_intro: 'Xin chào!',
    interests: [],
    photos: [PHOTO_STUB],
    created_days_ago: 30,
    expect_visible: true,
    expect_reason: 'T2 — 언어 lv 부족(en lv1), 국가 미부합(VN), 주언어=vi',
  },

  // ─── 주 언어 동일 하드 필터 검증 (primary == ko → 무조건 제외) ────────────
  {
    email: 'seed-langfilter-a@test.local',
    display_name: '시드_언어필터_A',
    birth_date: birthYearsAgo(27),
    gender: 'female',
    nationality: 'KR',
    languages: [{ code: 'ko', level: 3 }, { code: 'en', level: 2 }],
    voice_intro: '커피 좋아하는 사람과 친해지고 싶어요.',
    interests: ['coffee', 'travel', 'music', 'movies'],
    photos: [PHOTO_STUB, PHOTO_STUB, PHOTO_STUB, PHOTO_STUB],
    created_days_ago: 1,
    expect_visible: false,
    expect_reason: '주언어 동일(ko=ko) → 사전 필터에서 제외',
  },
  {
    email: 'seed-langfilter-b@test.local',
    display_name: '시드_언어필터_B',
    birth_date: birthYearsAgo(26),
    gender: 'female',
    nationality: 'CN',
    languages: [{ code: 'ko', level: 3 }],
    voice_intro: '한국에서 오래 살았어요.',
    interests: ['food'],
    photos: [PHOTO_STUB],
    created_days_ago: 8,
    expect_visible: false,
    expect_reason: '주언어 동일(ko=ko) → 사전 필터에서 제외 (선호 미부합 무관)',
  },

  // ─── 점수 변별 (T1 안에서 intra score 차이 검증) ─────────────────────────
  {
    email: 'seed-score-fresh@test.local',
    display_name: '시드_신규가입',
    birth_date: birthYearsAgo(25),
    gender: 'female',
    nationality: 'KR',
    languages: [{ code: 'en', level: 3 }, { code: 'ko', level: 2 }],
    voice_intro: '오늘 막 가입했어요!',
    interests: ['music', 'travel', 'coffee'],
    photos: [PHOTO_STUB, PHOTO_STUB, PHOTO_STUB],
    created_days_ago: 0, // 7일 이내 → +10
    expect_visible: true,
    expect_reason: 'T1 — 신규+사진+관심사 가산 모두 충족',
  },
  {
    email: 'seed-score-stale@test.local',
    display_name: '시드_고인물',
    birth_date: birthYearsAgo(34),
    gender: 'female',
    nationality: 'KR',
    languages: [{ code: 'en', level: 2 }, { code: 'ko', level: 3 }],
    voice_intro: '여기 가입한 지 좀 됐어요.',
    interests: [],
    photos: [PHOTO_STUB],
    created_days_ago: 60,
    expect_visible: true,
    expect_reason: 'T1 — intra score 낮음 (jitter만)',
  },

  // ─── 하드 필터 검증 (성별/연령/비활성). primary=en 으로 두어 언어 필터와 분리. ─
  {
    email: 'seed-filter-age@test.local',
    display_name: '시드_연령초과',
    birth_date: birthYearsAgo(50), // viewer max_age=35 → 제외
    gender: 'female',
    nationality: 'KR',
    languages: [{ code: 'en', level: 3 }],
    voice_intro: '나이 필터 테스트',
    interests: [],
    photos: [PHOTO_STUB],
    created_days_ago: 5,
    expect_visible: false,
    expect_reason: '연령 초과(50세 > max_age 35)',
  },
  {
    email: 'seed-filter-gender@test.local',
    display_name: '시드_성별불일치',
    birth_date: birthYearsAgo(28),
    gender: 'male', // viewer 선호 ['female']
    nationality: 'KR',
    languages: [{ code: 'en', level: 3 }],
    voice_intro: '성별 필터 테스트',
    interests: [],
    photos: [PHOTO_STUB],
    created_days_ago: 5,
    expect_visible: false,
    expect_reason: '성별 미부합(male ∉ [female])',
  },
  {
    email: 'seed-inactive@test.local',
    display_name: '시드_비활성',
    birth_date: birthYearsAgo(28),
    gender: 'female',
    nationality: 'KR',
    languages: [{ code: 'en', level: 3 }],
    voice_intro: '비활성 계정 테스트',
    interests: [],
    photos: [PHOTO_STUB],
    created_days_ago: 5,
    expect_visible: false,
    expect_reason: 'is_active=false',
  },
];

async function clean() {
  const { data: pages } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const targets = (pages?.users ?? []).filter(
    (u) => (u.app_metadata as any)?.tag === TAG,
  );
  console.log(`Cleaning ${targets.length} seeded users...`);
  for (const u of targets) {
    await supabase.auth.admin.deleteUser(u.id); // CASCADE로 profiles/user_preferences 삭제
  }
  console.log('Done.');
}

async function seed() {
  console.log(`Seeding ${seeds.length} candidates...`);
  for (const s of seeds) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: s.email,
      password: 'TestPassword!123',
      email_confirm: true,
      app_metadata: { tag: TAG },
    });
    if (createErr || !created.user) {
      console.error(`FAIL ${s.email}: ${createErr?.message}`);
      continue;
    }
    const id = created.user.id;
    const isInactive = s.email === 'seed-inactive@test.local';

    const { error: profErr } = await supabase.from('profiles').insert({
      id,
      display_name: s.display_name,
      birth_date: s.birth_date,
      gender: s.gender,
      nationality: s.nationality,
      languages: s.languages,
      voice_intro: s.voice_intro,
      interests: s.interests,
      photos: s.photos,
      voice_clone_status: 'ready', // 디스커버 응답에 보이려면 게이팅과 무관하지만 일관성 위해
      is_active: !isInactive,
      created_at: daysAgo(s.created_days_ago),
    });
    if (profErr) {
      console.error(`FAIL profile ${s.email}: ${profErr.message}`);
      continue;
    }
    const mark = s.expect_visible ? '[visible]' : '[filtered]';
    console.log(`OK ${s.display_name.padEnd(18)} ${mark}  — ${s.expect_reason}`);
  }
  console.log('\nLogin: 위 이메일 + 비밀번호 TestPassword!123');
  console.log('정리: npx tsx scripts/seed-test-candidates.ts --clean');
  console.log('\nViewer 가정: primary=ko, gender=female, age 20~35, langs=[en lv2], nat=[KR,JP,US]');
  console.log('  visible 6: T1_A, T1_B, T2_A, T2_B, score_fresh, score_stale');
  console.log('  filtered 5: langfilter_A, langfilter_B, age, gender, inactive');
}

const cmd = process.argv[2];
(cmd === '--clean' ? clean() : seed()).catch((e) => {
  console.error(e);
  process.exit(1);
});
