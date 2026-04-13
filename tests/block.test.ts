import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { mockFrom, createMockSupabaseQuery } from './setup';
import { generateTestToken, TEST_USER_ID, TEST_USER2_ID } from './helpers';

describe('Block Routes', () => {
  const token = generateTestToken();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/block', () => {
    it('자기 자신 차단 시 400', async () => {
      const res = await request(app)
        .post('/api/block')
        .set('Authorization', `Bearer ${token}`)
        .send({ blocked_id: TEST_USER_ID });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot block yourself');
    });

    it('차단 성공', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(null, null));

      const res = await request(app)
        .post('/api/block')
        .set('Authorization', `Bearer ${token}`)
        .send({ blocked_id: TEST_USER2_ID });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('blocked');
    });

    it('이미 차단된 유저면 409', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(null, { code: '23505', message: 'duplicate' }));

      const res = await request(app)
        .post('/api/block')
        .set('Authorization', `Bearer ${token}`)
        .send({ blocked_id: TEST_USER2_ID });

      expect(res.status).toBe(409);
    });

    it('blocked_id가 uuid가 아니면 400', async () => {
      const res = await request(app)
        .post('/api/block')
        .set('Authorization', `Bearer ${token}`)
        .send({ blocked_id: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/block/:blockedId', () => {
    it('차단 해제 성공', async () => {
      const query = createMockSupabaseQuery(null, null);
      // count를 반환하도록 thenable 재설정
      query.then = (resolve: any) => resolve({ data: null, error: null, count: 1 });
      mockFrom.mockReturnValue(query);

      const res = await request(app)
        .delete(`/api/block/${TEST_USER2_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('unblocked');
    });

    it('차단 내역 없으면 404', async () => {
      const query = createMockSupabaseQuery(null, null);
      query.then = (resolve: any) => resolve({ data: null, error: null, count: 0 });
      mockFrom.mockReturnValue(query);

      const res = await request(app)
        .delete(`/api/block/${TEST_USER2_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Block not found');
    });
  });

  describe('GET /api/block', () => {
    it('차단 목록 조회 성공', async () => {
      const blocks = [
        { blocked_id: TEST_USER2_ID, created_at: '2024-01-01T00:00:00Z', profile: { id: TEST_USER2_ID, display_name: 'Blocked User', photos: [] } },
      ];
      mockFrom.mockReturnValue(createMockSupabaseQuery(blocks));

      const res = await request(app)
        .get('/api/block')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].blocked_id).toBe(TEST_USER2_ID);
    });

    it('차단 목록이 비어있으면 빈 배열', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery([]));

      const res = await request(app)
        .get('/api/block')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
