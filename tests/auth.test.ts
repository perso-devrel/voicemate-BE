import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { supabaseAuth } from '../src/config/supabase';

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/signup', () => {
    it('email/password 없으면 400', async () => {
      const res = await request(app).post('/api/auth/signup').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('email and password are required');
    });

    it('회원가입 성공 시 201', async () => {
      vi.mocked(supabaseAuth.auth.signUp).mockResolvedValue({
        data: {
          session: {
            access_token: 'access-123',
            refresh_token: 'refresh-123',
          },
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      } as any);

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.access_token).toBe('access-123');
      expect(res.body.user.id).toBe('user-123');
    });

    it('중복 이메일이면 400', async () => {
      vi.mocked(supabaseAuth.auth.signUp).mockResolvedValue({
        data: { session: null, user: null } as any,
        error: { message: 'User already registered' } as any,
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'dup@example.com', password: 'password123' });

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
      vi.mocked(supabaseAuth.auth.signInWithPassword).mockResolvedValue({
        data: {
          session: {
            access_token: 'access-456',
            refresh_token: 'refresh-456',
          },
          user: {
            id: 'user-456',
            email: 'test@example.com',
          },
        },
        error: null,
      } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBe('access-456');
      expect(res.body.user.id).toBe('user-456');
    });

    it('잘못된 비밀번호면 401', async () => {
      vi.mocked(supabaseAuth.auth.signInWithPassword).mockResolvedValue({
        data: { session: null, user: null } as any,
        error: { message: 'Invalid login credentials' } as any,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/google', () => {
    it('id_token 없으면 400', async () => {
      const res = await request(app).post('/api/auth/google').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('id_token is required');
    });

    it('유효한 id_token으로 로그인 성공', async () => {
      vi.mocked(supabaseAuth.auth.signInWithIdToken).mockResolvedValue({
        data: {
          session: {
            access_token: 'access-123',
            refresh_token: 'refresh-123',
          },
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      } as any);

      const res = await request(app)
        .post('/api/auth/google')
        .send({ id_token: 'valid-google-token' });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBe('access-123');
      expect(res.body.refresh_token).toBe('refresh-123');
      expect(res.body.user.id).toBe('user-123');
    });

    it('잘못된 id_token이면 401', async () => {
      vi.mocked(supabaseAuth.auth.signInWithIdToken).mockResolvedValue({
        data: { session: null, user: null } as any,
        error: { message: 'Invalid token' } as any,
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ id_token: 'invalid-token' });

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
      vi.mocked(supabaseAuth.auth.refreshSession).mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access',
            refresh_token: 'new-refresh',
          },
          user: null,
        },
        error: null,
      } as any);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'valid-refresh' });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBe('new-access');
    });
  });
});
