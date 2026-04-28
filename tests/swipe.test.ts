import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { getAuthToken, createTestProfile, cleanupUser } from './helpers';

const EMAIL1 = 'apitest_swipe1@testmail.com';
const EMAIL2 = 'apitest_swipe2@testmail.com';
let token1: string;
let userId1: string;
let token2: string;
let userId2: string;

describe('Swipe Routes', () => {
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
      display_name: 'Swipe User 1',
      language: 'ko',
      nationality: 'KR',
    });
    await createTestProfile(token2, {
      display_name: 'Swipe User 2',
      language: 'ja',
      nationality: 'JP',
      gender: 'female',
    });
  });

  afterAll(async () => {
    await cleanupUser(userId1);
    await cleanupUser(userId2);
  });

  describe('GET /api/discover', () => {
    it('인증 없으면 401', async () => {
      const res = await request(app).get('/api/discover');
      expect(res.status).toBe(401);
    });

    it('후보 목록 조회 성공', async () => {
      const res = await request(app)
        .get('/api/discover')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // PhotoAccess: discover 는 잠금 해제 대상이 아님 → 항상 false/false,
      // 서버는 photos 를 메인 1장으로 필터링 (길이 0 또는 1).
      if (res.body.length > 0) {
        const candidate = res.body[0];
        expect(candidate).toHaveProperty('photo_access');
        expect(candidate.photo_access).toEqual({
          main_photo_unlocked: false,
          all_photos_unlocked: false,
        });
        expect(Array.isArray(candidate.photos)).toBe(true);
        expect(candidate.photos.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('POST /api/discover/swipe', () => {
    it('필수 필드 없으면 400', async () => {
      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token1}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('pass 스와이프 성공', async () => {
      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token1}`)
        .send({ swiped_id: userId2, direction: 'pass' });

      expect(res.status).toBe(200);
      expect(res.body.direction).toBe('pass');
    });

    it('중복 스와이프면 409', async () => {
      const res = await request(app)
        .post('/api/discover/swipe')
        .set('Authorization', `Bearer ${token1}`)
        .send({ swiped_id: userId2, direction: 'pass' });

      expect(res.status).toBe(409);
    });
  });
});
