import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { mockFrom, createMockSupabaseQuery } from './setup';
import { generateTestToken, TEST_USER_ID, TEST_USER2_ID, TEST_MATCH } from './helpers';

describe('Swipe Routes', () => {
  const token = generateTestToken();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/discover', () => {
    it('인증 없으면 401', async () => {
      const res = await request(app).get('/api/discover');
      expect(res.status).toBe(401);
    });

    it('프로필 없으면 404', async () => {
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery(null));

      const res = await request(app)
        .get('/api/discover')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('후보 목록 조회 성공', async () => {
      const candidates = [
        {
          id: TEST_USER2_ID,
          display_name: 'User2',
          nationality: 'JP',
          language: 'ja',
          interests: [],
          photos: [],
          voice_clone_status: 'pending',
          bio: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery({ language: 'ko', interests: ['music'] }))
        .mockReturnValueOnce(createMockSupabaseQuery([]))
        .mockReturnValueOnce(createMockSupabaseQuery([]))
        .mockReturnValueOnce(createMockSupabaseQuery(null))
        .mockReturnValueOnce(createMockSupabaseQuery(candidates));

      const res = await request(app)
        .get('/api/discover')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it('limit 파라미터 적용', async () => {
      const candidates = [
        { id: 'aaa-1', display_name: 'A', nationality: 'JP', language: 'ja', interests: [], photos: [], voice_clone_status: 'pending', bio: null, created_at: '2024-01-01T00:00:00Z' },
        { id: 'aaa-2', display_name: 'B', nationality: 'US', language: 'en', interests: [], photos: [], voice_clone_status: 'pending', bio: null, created_at: '2024-01-01T00:00:00Z' },
        { id: 'aaa-3', display_name: 'C', nationality: 'CN', language: 'zh', interests: [], photos: [], voice_clone_status: 'pending', bio: null, created_at: '2024-01-01T00:00:00Z' },
      ];

      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery({ language: 'ko', interests: [] }))
        .mockReturnValueOnce(createMockSupabaseQuery([]))
        .mockReturnValueOnce(createMockSupabaseQuery([]))
        .mockReturnValueOnce(createMockSupabaseQuery(null))
        .mockReturnValueOnce(createMockSupabaseQuery(candidates));

      const res = await request(app)
        .get('/api/discover?limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(2);
    });

    it('응답에 내부 필드(_score, voice_clone_status, created_at) 미포함', async () => {
      const candidates = [
        { id: TEST_USER2_ID, display_name: 'User2', nationality: 'JP', language: 'ja', interests: [], photos: [], voice_clone_status: 'ready', bio: 'hi', created_at: '2024-01-01T00:00:00Z' },
      ];

      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery({ language: 'ko', interests: [] }))
        .mockReturnValueOnce(createMockSupabaseQuery([]))
        .mockReturnValueOnce(createMockSupabaseQuery([]))
        .mockReturnValueOnce(createMockSupabaseQuery(null))
        .mockReturnValueOnce(createMockSupabaseQuery(candidates));

      const res = await request(app)
        .get('/api/discover')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body[0]._score).toBeUndefined();
      expect(res.body[0].voice_clone_status).toBeUndefined();
      expect(res.body[0].created_at).toBeUndefined();
    });
  });

  describe('POST /api/discover/swipe', () => {
    it('필수 필드 없으면 400', async () => {
      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('like 스와이프 성공 (매치 없음)', async () => {
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(null, null))
        .mockReturnValueOnce(createMockSupabaseQuery(null));

      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token}`)
        .send({ swiped_id: TEST_USER2_ID, direction: 'like' });

      expect(res.status).toBe(200);
      expect(res.body.direction).toBe('like');
      expect(res.body.match).toBeNull();
    });

    it('상호 like 시 매치 생성', async () => {
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(null, null)) // swipe insert
        .mockReturnValueOnce(createMockSupabaseQuery({ id: 'reciprocal-swipe' })) // reciprocal exists
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH)); // match insert

      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token}`)
        .send({ swiped_id: TEST_USER2_ID, direction: 'like' });

      expect(res.status).toBe(200);
      expect(res.body.match).toBeDefined();
      expect(res.body.match.id).toBe(TEST_MATCH.id);
    });

    it('동시 like race condition — 중복 매치 시 기존 매치 반환', async () => {
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(null, null)) // swipe insert
        .mockReturnValueOnce(createMockSupabaseQuery({ id: 'reciprocal-swipe' })) // reciprocal exists
        .mockReturnValueOnce(createMockSupabaseQuery(null, { code: '23505', message: 'duplicate' })) // match insert → duplicate
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH)); // existing match select

      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token}`)
        .send({ swiped_id: TEST_USER2_ID, direction: 'like' });

      expect(res.status).toBe(200);
      expect(res.body.match).toBeDefined();
      expect(res.body.match.id).toBe(TEST_MATCH.id);
    });

    it('pass 스와이프 성공', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(null, null));

      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token}`)
        .send({ swiped_id: TEST_USER2_ID, direction: 'pass' });

      expect(res.status).toBe(200);
      expect(res.body.direction).toBe('pass');
    });

    it('중복 스와이프면 409', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(null, { code: '23505', message: 'duplicate' }));

      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token}`)
        .send({ swiped_id: TEST_USER2_ID, direction: 'like' });

      expect(res.status).toBe(409);
    });
  });
});
