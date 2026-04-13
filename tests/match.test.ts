import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { mockFrom, mockRpc, createMockSupabaseQuery } from './setup';
import { generateTestToken, TEST_USER_ID, TEST_USER2_ID, TEST_MATCH } from './helpers';

describe('Match Routes', () => {
  const token = generateTestToken();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/matches', () => {
    it('인증 없으면 401', async () => {
      const res = await request(app).get('/api/matches');
      expect(res.status).toBe(401);
    });

    it('매치 목록 조회 성공', async () => {
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery([TEST_MATCH]));
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery([{
        id: TEST_USER2_ID,
        display_name: 'Partner',
        photos: [],
        nationality: 'JP',
        language: 'ja',
      }]));
      mockRpc.mockResolvedValueOnce({
        data: [{
          match_id: TEST_MATCH.id,
          last_message_id: 'msg-1',
          last_message_text: 'Hello',
          last_message_sender_id: TEST_USER2_ID,
          last_message_created_at: '2024-01-02T00:00:00Z',
          unread_count: 3,
        }],
        error: null,
      });

      const res = await request(app)
        .get('/api/matches')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].match_id).toBe(TEST_MATCH.id);
      expect(res.body[0].partner.display_name).toBe('Partner');
      expect(res.body[0].last_message).toBeDefined();
      expect(res.body[0].last_message.original_text).toBe('Hello');
      expect(res.body[0].unread_count).toBe(3);
    });

    it('매치 없으면 빈 배열', async () => {
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery([]));

      const res = await request(app)
        .get('/api/matches')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('limit 파라미터 적용', async () => {
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery([]));

      const res = await request(app)
        .get('/api/matches?limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('before 커서 파라미터 적용', async () => {
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery([]));

      const res = await request(app)
        .get('/api/matches?before=2024-06-01T00:00:00Z')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('잘못된 limit이면 400', async () => {
      const res = await request(app)
        .get('/api/matches?limit=999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/matches/:matchId', () => {
    it('매치가 없으면 404', async () => {
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery(null));

      const res = await request(app)
        .delete(`/api/matches/${TEST_MATCH.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('언매치 성공', async () => {
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH))
        .mockReturnValueOnce(createMockSupabaseQuery(null, null));

      const res = await request(app)
        .delete(`/api/matches/${TEST_MATCH.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('unmatched');
    });
  });
});
