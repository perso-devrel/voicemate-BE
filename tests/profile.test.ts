import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { mockFrom } from './setup';
import { generateTestToken, TEST_USER_ID, TEST_PROFILE } from './helpers';
import { createMockSupabaseQuery } from './setup';

describe('Profile Routes', () => {
  const token = generateTestToken();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/profile/me', () => {
    it('인증 없으면 401', async () => {
      const res = await request(app).get('/api/profile/me');
      expect(res.status).toBe(401);
    });

    it('프로필 조회 성공', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(TEST_PROFILE));

      const res = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.display_name).toBe('Test User');
    });

    it('프로필 없으면 404', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(null, { message: 'not found' }));

      const res = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/profile/me', () => {
    it('프로필 생성/수정 성공', async () => {
      const updatedProfile = { ...TEST_PROFILE, display_name: 'Updated' };
      mockFrom.mockReturnValue(createMockSupabaseQuery(updatedProfile));

      const res = await request(app)
        .put('/api/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          display_name: 'Updated',
          birth_date: '1995-01-01',
          gender: 'male',
          nationality: 'KR',
          language: 'ko',
        });

      expect(res.status).toBe(200);
      expect(res.body.display_name).toBe('Updated');
    });
  });

  describe('POST /api/profile/photos', () => {
    it('파일 없으면 400', async () => {
      const res = await request(app)
        .post('/api/profile/photos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No photo file provided');
    });

    it('허용되지 않는 MIME 타입이면 400', async () => {
      const res = await request(app)
        .post('/api/profile/photos')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', Buffer.from('fake'), { filename: 'test.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Only JPEG, PNG, WebP images are allowed');
    });

    it('application/javascript 업로드 차단', async () => {
      const res = await request(app)
        .post('/api/profile/photos')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', Buffer.from('alert(1)'), { filename: 'evil.js', contentType: 'application/javascript' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Only JPEG, PNG, WebP images are allowed');
    });

    it('사진 업로드 성공 (JPEG)', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery({ photos: ['existing.jpg'] }));

      const res = await request(app)
        .post('/api/profile/photos')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', Buffer.from('fake-image'), { filename: 'test.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
    });

    it('사진 업로드 성공 (WebP)', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery({ photos: [] }));

      const res = await request(app)
        .post('/api/profile/photos')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', Buffer.from('fake-image'), { filename: 'test.webp', contentType: 'image/webp' });

      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
    });

    it('사진 6장 초과시 400', async () => {
      mockFrom.mockReturnValue(
        createMockSupabaseQuery({
          photos: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg'],
        })
      );

      const res = await request(app)
        .post('/api/profile/photos')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', Buffer.from('fake-image'), { filename: 'test.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Maximum 6 photos allowed');
    });
  });

  describe('DELETE /api/profile/photos/:index', () => {
    it('유효하지 않은 인덱스면 400', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery({ photos: ['photo1.jpg'] }));

      const res = await request(app)
        .delete('/api/profile/photos/5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid photo index');
    });

    it('사진 삭제 성공', async () => {
      const query = createMockSupabaseQuery({ photos: ['photo1.jpg', 'photo2.jpg'] });
      mockFrom.mockReturnValue(query);

      const res = await request(app)
        .delete('/api/profile/photos/0')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.photos).toHaveLength(1);
    });
  });
});
