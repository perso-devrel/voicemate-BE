import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { getAuthToken, createTestProfile, cleanupUser } from './helpers';

const EMAIL1 = 'apitest_msg1@testmail.com';
const EMAIL2 = 'apitest_msg2@testmail.com';
let token1: string;
let userId1: string;
let token2: string;
let userId2: string;
let matchId: string;

describe('Message Routes', () => {
  beforeAll(async () => {
    const auth1 = await getAuthToken(EMAIL1);
    const auth2 = await getAuthToken(EMAIL2);
    token1 = auth1.token;
    userId1 = auth1.userId;
    token2 = auth2.token;
    userId2 = auth2.userId;

    await cleanupUser(userId1);
    await cleanupUser(userId2);

    await createTestProfile(token1, {
      display_name: 'Msg User 1',
      language: 'ko',
      nationality: 'KR',
    });
    await createTestProfile(token2, {
      display_name: 'Msg User 2',
      language: 'ja',
      nationality: 'JP',
      gender: 'female',
    });

    // mutual like to create match
    await request(app)
      .post('/api/discover/swipe')
      .set('Authorization', `Bearer ${token1}`)
      .send({ swiped_id: userId2, direction: 'like' });

    const swipeRes = await request(app)
      .post('/api/discover/swipe')
      .set('Authorization', `Bearer ${token2}`)
      .send({ swiped_id: userId1, direction: 'like' });

    matchId = swipeRes.body.match?.id;
  });

  afterAll(async () => {
    await cleanupUser(userId1);
    await cleanupUser(userId2);
  });

  describe('POST /api/matches/:matchId/messages', () => {
    it('text 없으면 400', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token1}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('매치 비참여자면 403', async () => {
      const other = await getAuthToken('apitest_msg_other@testmail.com');
      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ text: 'Hello' });
      expect(res.status).toBe(403);
    });

    it('메시지 전송 성공', async () => {
      expect(matchId).toBeDefined();

      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ text: 'Hello!' });

      expect(res.status).toBe(201);
      expect(res.body.original_text).toBe('Hello!');
      expect(res.body.sender_id).toBe(userId1);
      expect(res.body.emotion).toBeNull();
    });

    it('emotion 포함 전송 성공', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ text: '왜 이제야 연락해?', emotion: 'angry' });

      expect(res.status).toBe(201);
      expect(res.body.emotion).toBe('angry');
    });

    it('emotion=neutral은 null로 저장', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ text: 'hi', emotion: 'neutral' });

      expect(res.status).toBe(201);
      expect(res.body.emotion).toBeNull();
    });

    it('잘못된 emotion 값이면 400', async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ text: 'hi', emotion: 'sleepy' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/matches/:matchId/messages', () => {
    it('메시지 목록 조회 성공', async () => {
      const res = await request(app)
        .get(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('매치 비참여자면 403', async () => {
      const other = await getAuthToken('apitest_msg_other@testmail.com');
      const res = await request(app)
        .get(`/api/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${other.token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/matches/:matchId/messages/read', () => {
    it('읽음 처리 성공', async () => {
      const res = await request(app)
        .patch(`/api/matches/${matchId}/messages/read`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('read_count');
    });
  });
});
