import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { mockFrom, createMockSupabaseQuery } from './setup';
import { generateTestToken } from './helpers';

describe('Voice Routes', () => {
  const token = generateTestToken();

  beforeEach(() => {
    vi.clearAllMocks();
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
        .attach('audio', Buffer.from('fake'), { filename: 'test.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Only audio files (WAV, MP3, MP4, OGG, WebM) are allowed');
    });

    it('application/octet-stream 업로드 차단', async () => {
      const res = await request(app)
        .post('/api/voice/clone')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', Buffer.from('fake'), { filename: 'test.bin', contentType: 'application/octet-stream' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Only audio files (WAV, MP3, MP4, OGG, WebM) are allowed');
    });

    it('음성 클론 생성 성공 (WAV)', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(null, null));

      const res = await request(app)
        .post('/api/voice/clone')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', Buffer.from('fake-audio-data'), { filename: 'test.wav', contentType: 'audio/wav' });

      expect(res.status).toBe(200);
      expect(res.body.voice_id).toBe('mock-voice-id');
      expect(res.body.status).toBe('ready');
    });

    it('음성 클론 생성 성공 (MP3)', async () => {
      mockFrom.mockReturnValue(createMockSupabaseQuery(null, null));

      const res = await request(app)
        .post('/api/voice/clone')
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', Buffer.from('fake-audio-data'), { filename: 'test.mp3', contentType: 'audio/mpeg' });

      expect(res.status).toBe(200);
      expect(res.body.voice_id).toBe('mock-voice-id');
    });
  });

  describe('GET /api/voice/status', () => {
    it('클론 상태 조회 성공', async () => {
      mockFrom.mockReturnValue(
        createMockSupabaseQuery({ voice_clone_status: 'ready', elevenlabs_voice_id: 'voice-123' })
      );

      const res = await request(app)
        .get('/api/voice/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.voice_id).toBe('voice-123');
    });
  });

  describe('DELETE /api/voice/clone', () => {
    it('클론 삭제 성공', async () => {
      mockFrom.mockReturnValue(
        createMockSupabaseQuery({ elevenlabs_voice_id: 'voice-123' })
      );

      const res = await request(app)
        .delete('/api/voice/clone')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('deleted');
    });
  });
});
