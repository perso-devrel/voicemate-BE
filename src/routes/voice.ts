import { Router, Response } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase';
import { uploadFile } from '../services/storage';
import { createVoiceClone, deleteVoiceClone } from '../services/elevenlabs';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

router.use(authMiddleware);

const ALLOWED_AUDIO_TYPES = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/webm'];

// 음성 샘플 업로드 + ElevenLabs 클론 생성
router.post('/clone', upload.single('audio'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  if (!ALLOWED_AUDIO_TYPES.includes(req.file.mimetype)) {
    res.status(400).json({ error: 'Only audio files (WAV, MP3, MP4, OGG, WebM) are allowed' });
    return;
  }

  try {
    // 상태를 processing으로 업데이트
    await supabase
      .from('profiles')
      .update({ voice_clone_status: 'processing' })
      .eq('id', req.userId!);

    const path = `${req.userId!}.wav`;
    const voiceSampleUrl = await uploadFile('voice-samples', path, req.file.buffer, req.file.mimetype);

    // ElevenLabs 클론 생성
    const voiceId = await createVoiceClone(req.userId!, req.file.buffer, req.file.originalname);

    // 프로필 업데이트
    await supabase
      .from('profiles')
      .update({
        elevenlabs_voice_id: voiceId,
        voice_sample_url: voiceSampleUrl,
        voice_clone_status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.userId!);

    res.json({ voice_id: voiceId, status: 'ready' });
  } catch (error) {
    await supabase
      .from('profiles')
      .update({ voice_clone_status: 'failed' })
      .eq('id', req.userId!);

    res.status(500).json({ error: 'Voice clone creation failed' });
  }
});

// 클론 상태 확인
router.get('/status', async (req: AuthRequest, res: Response) => {
  const { data } = await supabase
    .from('profiles')
    .select('voice_clone_status, elevenlabs_voice_id')
    .eq('id', req.userId!)
    .single();

  res.json({
    status: data?.voice_clone_status || 'pending',
    voice_id: data?.elevenlabs_voice_id,
  });
});

// 클론 삭제
router.delete('/clone', async (req: AuthRequest, res: Response) => {
  const { data } = await supabase
    .from('profiles')
    .select('elevenlabs_voice_id')
    .eq('id', req.userId!)
    .single();

  if (data?.elevenlabs_voice_id) {
    await deleteVoiceClone(data.elevenlabs_voice_id);
  }

  await supabase
    .from('profiles')
    .update({
      elevenlabs_voice_id: null,
      voice_clone_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.userId!);

  res.json({ status: 'deleted' });
});

export default router;
