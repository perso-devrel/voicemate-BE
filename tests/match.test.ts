import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { getAuthToken, createTestProfile, cleanupUser } from './helpers';

const EMAIL1 = 'apitest_match1@testmail.com';
const EMAIL2 = 'apitest_match2@testmail.com';
let token1: string;
let userId1: string;
let token2: string;
let userId2: string;
let matchId: string;

describe('Match Routes', () => {
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
      display_name: 'Match User 1',
      language: 'ko',
      nationality: 'KR',
    });
    await createTestProfile(token2, {
      display_name: 'Match User 2',
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

  describe('GET /api/matches', () => {
    it('인증 없으면 401', async () => {
      const res = await request(app).get('/api/matches');
      expect(res.status).toBe(401);
    });

    it('매치 목록 조회 성공', async () => {
      const res = await request(app)
        .get('/api/matches')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('match_id');
      expect(res.body[0]).toHaveProperty('partner');

      // PhotoAccess: 매치 직후 메시지 0개 → round_trip_count=0 → 둘 다 false
      expect(res.body[0]).toHaveProperty('photo_access');
      expect(res.body[0].photo_access).toEqual({
        main_photo_unlocked: false,
        all_photos_unlocked: false,
      });

      // 보안 경계: all_photos_unlocked=false 이므로 서버가 photos 를 메인 1장 이하로 잘라낸다.
      if (res.body[0].partner) {
        expect(Array.isArray(res.body[0].partner.photos)).toBe(true);
        expect(res.body[0].partner.photos.length).toBeLessThanOrEqual(1);
      }
    });

    it('잘못된 limit이면 400', async () => {
      const res = await request(app)
        .get('/api/matches?limit=999')
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/matches/:matchId', () => {
    it('존재하지 않는 매치면 404', async () => {
      const res = await request(app)
        .delete('/api/matches/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(404);
    });

    it('언매치 성공', async () => {
      expect(matchId).toBeDefined();

      const res = await request(app)
        .delete(`/api/matches/${matchId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('unmatched');
    });
  });
});
