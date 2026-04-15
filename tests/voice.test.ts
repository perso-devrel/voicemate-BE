import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { getAuthToken, createTestProfile } from './helpers';

const TEST_EMAIL = 'apitest_voice@testmail.com';
let token: string;

describe('Voice Routes', () => {
  beforeAll(async () => {
    const auth = await getAuthToken(TEST_EMAIL);
    token = auth.token;
    await createTestProfile(token);
  });

  describe('POST /api/voice/clone', () => {
    it('파일 없으면 400', async () => {
      const res = await request(app)
        .post('/api/voice/clone')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No audio file provided');
    });

    it('허용되지 않는 MIME 타입이면 400', async () => {
      const res = await request(app)
        .post('/api/voice/clone')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', Buffer.from('fake'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'Only audio files (WAV, MP3, MP4, OGG, WebM) are allowed',
      );
    });

    it('application/octet-stream 업로드 차단', async () => {
      const res = await request(app)
        .post('/api/voice/clone')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', Buffer.from('fake'), {
          filename: 'test.bin',
          contentType: 'application/octet-stream',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/voice/status', () => {
    it('클론 상태 조회 성공', async () => {
      const res = await request(app)
        .get('/api/voice/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
    });
  });
});
