import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Service role client — RLS 우회, 데이터 CRUD 전용
export const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Auth client — 사용자 인증 전용 (anon key 사용, 없으면 service role fallback)
export const supabaseAuth = createClient(
  env.supabase.url,
  env.supabase.anonKey || env.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
