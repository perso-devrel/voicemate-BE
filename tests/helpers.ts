import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';

export const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
export const TEST_USER2_ID = '550e8400-e29b-41d4-a716-446655440001';

export function generateTestToken(userId: string = TEST_USER_ID): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
}

export const TEST_PROFILE = {
  id: TEST_USER_ID,
  display_name: 'Test User',
  birth_date: '1995-01-01',
  gender: 'male',
  nationality: 'KR',
  language: 'ko',
  bio: 'Hello',
  interests: ['music', 'travel'],
  photos: ['https://example.com/photo1.jpg'],
  elevenlabs_voice_id: null,
  voice_sample_url: null,
  voice_clone_status: 'pending',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const TEST_MATCH = {
  id: '660e8400-e29b-41d4-a716-446655440000',
  user1_id: TEST_USER_ID,
  user2_id: TEST_USER2_ID,
  created_at: '2024-01-01T00:00:00Z',
};
