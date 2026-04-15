import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { getAuthToken, createTestProfile, cleanupUser } from './helpers';

const EMAIL1 = 'apitest_block1@testmail.com';
const EMAIL2 = 'apitest_block2@testmail.com';
let token1: string;
let userId1: string;
let userId2: string;

describe('Block Routes', () => {
  beforeAll(async () => {
    const auth1 = await getAuthToken(EMAIL1);
    const auth2 = await getAuthToken(EMAIL2);
    token1 = auth1.token;
    userId1 = auth1.userId;
    userId2 = auth2.userId;

    await cleanupUser(userId1);
    await cleanupUser(userId2);

    await createTestProfile(token1, { display_name: 'Block User 1' });
    await createTestProfile(auth2.token, { display_name: 'Block User 2', gender: 'female' });
  });

  afterAll(async () => {
    await cleanupUser(userId1);
    await cleanupUser(userId2);
  });

  describe('POST /api/block', () => {
    it('자기 자신 차단 시 400', async () => {
      const res = await request(app)
        .post('/api/block')
        .set('Authorization', `Bearer ${token1}`)
        .send({ blocked_id: userId1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot block yourself');
    });

    it('blocked_id가 uuid가 아니면 400', async () => {
      const res = await request(app)
        .post('/api/block')
        .set('Authorization', `Bearer ${token1}`)
        .send({ blocked_id: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('차단 성공', async () => {
      const res = await request(app)
        .post('/api/block')
        .set('Authorization', `Bearer ${token1}`)
        .send({ blocked_id: userId2 });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('blocked');
    });

    it('이미 차단된 유저면 409', async () => {
      const res = await request(app)
        .post('/api/block')
        .set('Authorization', `Bearer ${token1}`)
        .send({ blocked_id: userId2 });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/block', () => {
    it('차단 목록 조회 성공', async () => {
      const res = await request(app)
        .get('/api/block')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /api/block/:blockedId', () => {
    it('차단 해제 성공', async () => {
      const res = await request(app)
        .delete(`/api/block/${userId2}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('unblocked');
    });

    it('차단 내역 없으면 404', async () => {
      const res = await request(app)
        .delete(`/api/block/${userId2}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(404);
    });
  });
});
