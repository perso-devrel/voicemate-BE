import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { getAuthToken, TEST_PASSWORD } from './helpers';

const TEST_EMAIL = 'apitest_auth@testmail.com';

describe('Auth Routes', () => {
  describe('POST /api/auth/signup', () => {
    it('email/password 없으면 400', async () => {
      const res = await request(app).post('/api/auth/signup').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('email and password are required');
    });

    it('email만 있으면 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@testmail.com' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('email/password 없으면 400', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('email and password are required');
    });

    it('로그인 성공', async () => {
      const { token, userId } = await getAuthToken(TEST_EMAIL);
      expect(token).toBeDefined();
      expect(userId).toBeDefined();
    });

    it('잘못된 비밀번호면 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('refresh_token 없으면 400', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('refresh_token is required');
    });

    it('유효한 refresh_token으로 갱신 성공', async () => {
      // login to get refresh token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: loginRes.body.refresh_token });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
    });
  });
});
