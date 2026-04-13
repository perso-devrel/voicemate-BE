import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { mockFrom, createMockSupabaseQuery } from './setup';
import { generateTestToken, TEST_USER_ID, TEST_USER2_ID, TEST_MATCH } from './helpers';

describe('Message Routes', () => {
  const token = generateTestToken();
  const matchId = TEST_MATCH.id;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/matches/:matchId/messages', () => {
    it('매치 멤버가 아니면 403', async () => {
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery(null));

      const res = await request(app)
        .get(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('메시지 목록 조회 성공', async () => {
      const messages = [
        { id: 'msg-1', match_id: matchId, sender_id: TEST_USER_ID, original_text: 'Hello', created_at: '2024-01-01T12:00:00Z' },
        { id: 'msg-2', match_id: matchId, sender_id: TEST_USER2_ID, original_text: 'Hi', created_at: '2024-01-01T12:01:00Z' },
      ];
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH))
        .mockReturnValueOnce(createMockSupabaseQuery(messages));

      const res = await request(app)
        .get(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('limit 파라미터 적용', async () => {
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH))
        .mockReturnValueOnce(createMockSupabaseQuery([]));

      const res = await request(app)
        .get(`/api/matches/${matchId}/messages?limit=10`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('before 커서 파라미터 적용', async () => {
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH))
        .mockReturnValueOnce(createMockSupabaseQuery([]));

      const res = await request(app)
        .get(`/api/matches/${matchId}/messages?before=2024-06-01T00:00:00Z`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/matches/:matchId/messages', () => {
    it('text 없으면 400', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('text');
    });

    it('text가 빈 문자열이면 400', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '   ' });

      expect(res.status).toBe(400);
    });

    it('매치 멤버가 아니면 403', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(null));

      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello' });

      expect(res.status).toBe(403);
    });

    it('언매치된 매치에 메시지 전송 시 403', async () => {
      const unmatchedMatch = { ...TEST_MATCH, unmatched_at: '2024-06-01T00:00:00Z' };
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery(unmatchedMatch));

      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('unmatched');
    });

    it('차단된 유저에게 메시지 전송 시 403', async () => {
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH)) // match check
        .mockReturnValueOnce(createMockSupabaseQuery([{ id: 'block-1' }])); // block exists

      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('blocked');
    });

    it('메시지 전송 성공', async () => {
      const newMessage = {
        id: 'msg-new',
        match_id: matchId,
        sender_id: TEST_USER_ID,
        original_text: 'Hello!',
        original_language: 'ko',
        audio_status: 'pending',
      };

      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH))
        .mockReturnValueOnce(createMockSupabaseQuery([]))
        .mockReturnValueOnce(createMockSupabaseQuery({ language: 'ko', elevenlabs_voice_id: null }))
        .mockReturnValueOnce(createMockSupabaseQuery({ language: 'ja' }))
        .mockReturnValueOnce(createMockSupabaseQuery(newMessage));

      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello!' });

      expect(res.status).toBe(201);
      expect(res.body.original_text).toBe('Hello!');
      expect(res.body.audio_status).toBe('pending');
    });

    it('voice clone 있으면 audio_status가 processing', async () => {
      const newMessage = {
        id: 'msg-new',
        match_id: matchId,
        sender_id: TEST_USER_ID,
        original_text: 'Hello!',
        original_language: 'ko',
        audio_status: 'processing',
      };

      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery(TEST_MATCH))
        .mockReturnValueOnce(createMockSupabaseQuery([]))
        .mockReturnValueOnce(createMockSupabaseQuery({ language: 'ko', elevenlabs_voice_id: 'voice-123' }))
        .mockReturnValueOnce(createMockSupabaseQuery({ language: 'ja' }))
        .mockReturnValueOnce(createMockSupabaseQuery(newMessage));

      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Hello!' });

      expect(res.status).toBe(201);
      expect(res.body.audio_status).toBe('processing');
    });
  });

  describe('PATCH /api/matches/:matchId/messages/read', () => {
    it('매치 멤버가 아니면 403', async () => {
      mockFrom.mockReturnValueOnce(createMockSupabaseQuery(null));

      const res = await request(app)
        .patch(`/api/matches/${matchId}/messages/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('읽음 처리 성공', async () => {
      mockFrom
        .mockReturnValueOnce(createMockSupabaseQuery({ id: matchId })) // match check
        .mockReturnValueOnce(createMockSupabaseQuery(null, null)); // update (count via thenable)

      const res = await request(app)
        .patch(`/api/matches/${matchId}/messages/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('read_count');
    });
  });
});
