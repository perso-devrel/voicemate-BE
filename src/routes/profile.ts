import { Router, Response } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase';
import { uploadFile, deleteFile, extractPath } from '../services/storage';
import { generateDubbedAudio } from '../services/elevenlabs';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { profileUpsertSchema } from '../schemas/profile';
import { AuthRequest } from '../types';

const router = Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

router.use(authMiddleware);

// 내 프로필 조회
router.get('/me', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.userId!)
    .single();

  if (error) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  res.json(data);
});

// 내 프로필 수정 (생성 포함 - upsert)
router.put('/me', validateBody(profileUpsertSchema), async (req: AuthRequest, res: Response) => {
  const { display_name, birth_date, gender, nationality, language, bio, interests } = req.body;

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: req.userId!,
      display_name,
      birth_date,
      gender,
      nationality,
      language,
      bio,
      interests: interests || [],
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  // bio가 있고 voice clone이 있으면 비동기로 bio 오디오 생성
  if (bio && data.elevenlabs_voice_id) {
    generateBioAudio(req.userId!, bio, data.elevenlabs_voice_id, language)
      .catch((err) => console.error('[Bio audio generation failed]', err));
  } else if (!bio && data.bio_audio_url) {
    // bio 삭제 시 오디오도 제거
    await supabase
      .from('profiles')
      .update({ bio_audio_url: null })
      .eq('id', req.userId!);
    data.bio_audio_url = null;
  }

  res.json(data);
});

async function generateBioAudio(
  userId: string,
  bio: string,
  voiceId: string,
  language: string
): Promise<void> {
  try {
    // 본인 언어로 TTS (번역 없이 본인 목소리로 자기소개 읽기)
    const { audio } = await generateDubbedAudio(bio, voiceId, language, language);
    const path = `${userId}/bio.mp3`;
    const audioUrl = await uploadFile('bio-audio', path, audio, 'audio/mpeg');

    await supabase
      .from('profiles')
      .update({ bio_audio_url: audioUrl })
      .eq('id', userId);
  } catch (error) {
    console.error(`[Bio Audio Error] userId=${userId}:`, error);
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// 프로필 사진 업로드
router.post('/photos', upload.single('photo'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No photo file provided' });
    return;
  }

  if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
    res.status(400).json({ error: 'Only JPEG, PNG, WebP images are allowed' });
    return;
  }

  // 현재 사진 개수 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('photos')
    .eq('id', req.userId!)
    .single();

  const currentPhotos: string[] = profile?.photos || [];
  if (currentPhotos.length >= 6) {
    res.status(400).json({ error: 'Maximum 6 photos allowed' });
    return;
  }

  const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${req.userId!}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const url = await uploadFile('photos', path, req.file.buffer, req.file.mimetype);

  const updatedPhotos = [...currentPhotos, url];
  await supabase
    .from('profiles')
    .update({ photos: updatedPhotos, updated_at: new Date().toISOString() })
    .eq('id', req.userId!);

  res.json({ url, photos: updatedPhotos });
});

// 프로필 사진 삭제
router.delete('/photos/:index', async (req: AuthRequest, res: Response) => {
  const index = parseInt(req.params.index as string, 10);

  const { data: profile } = await supabase
    .from('profiles')
    .select('photos')
    .eq('id', req.userId!)
    .single();

  const currentPhotos: string[] = profile?.photos || [];
  if (index < 0 || index >= currentPhotos.length) {
    res.status(400).json({ error: 'Invalid photo index' });
    return;
  }

  const photoUrl = currentPhotos[index];
  const updatedPhotos = currentPhotos.filter((_, i) => i !== index);

  // DB 먼저 업데이트 (실패 시 Storage 고아 파일보다 DB 불일치가 더 위험)
  await supabase
    .from('profiles')
    .update({ photos: updatedPhotos, updated_at: new Date().toISOString() })
    .eq('id', req.userId!);

  const path = extractPath('photos', photoUrl);
  deleteFile('photos', path).catch((err) => console.error('[Photo delete from storage failed]', err));

  res.json({ photos: updatedPhotos });
});

export default router;
