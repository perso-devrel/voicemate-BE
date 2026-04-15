import request from 'supertest';
import { app } from '../src/index';
import { supabase } from '../src/config/supabase';

export const TEST_PASSWORD = 'testpass123';

export async function getAuthToken(
  email: string,
  password: string = TEST_PASSWORD,
): Promise<{ token: string; userId: string }> {
  // try login first
  let res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status === 200) {
    return { token: res.body.access_token, userId: res.body.user.id };
  }

  // create user via admin API (bypasses rate limit, auto-confirms email)
  const createResult = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createResult.error) {
    if (createResult.error.message.includes('already been registered')) {
      // user exists but unconfirmed — find and confirm via admin
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const user = users.find((u) => u.email === email);
      if (user) {
        await supabase.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });
      }
    } else {
      throw new Error(`Admin create failed for ${email}: ${createResult.error.message}`);
    }
  }

  // login
  res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status === 200) {
    return { token: res.body.access_token, userId: res.body.user.id };
  }

  throw new Error(`Auth failed for ${email}: ${res.body.error}`);
}

export async function createTestProfile(
  token: string,
  overrides: Record<string, any> = {},
) {
  const res = await request(app)
    .put('/api/profile/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      display_name: 'Test User',
      birth_date: '1995-01-01',
      gender: 'male',
      nationality: 'KR',
      language: 'ko',
      ...overrides,
    });
  return res.body;
}

export async function cleanupUser(userId: string) {
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

  if (matches?.length) {
    for (const match of matches) {
      await supabase.from('messages').delete().eq('match_id', match.id);
    }
    await supabase
      .from('matches')
      .delete()
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
  }

  await supabase.from('swipes').delete().eq('swiper_id', userId);
  await supabase.from('swipes').delete().eq('swiped_id', userId);
  await supabase.from('blocks').delete().eq('blocker_id', userId);
  await supabase.from('blocks').delete().eq('blocked_id', userId);
  await supabase.from('reports').delete().eq('reporter_id', userId);
  await supabase.from('reports').delete().eq('reported_id', userId);
  await supabase.from('user_preferences').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);
}
