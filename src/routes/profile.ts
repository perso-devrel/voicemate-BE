import { Router, Response } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase';
import { uploadFile, deleteFile, extractPath } from '../services/storage';
import { synthesizeSpeech } from '../services/elevenlabs';
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

  // 기존 bio를 조회해 변경 여부 판단. bio가 바뀌지 않았으면 TTS 재생성을 건너뛰어
  // 불필요한 ElevenLabs 호출을 막는다.
  const { data: prev } = await supabase
    .from('profiles')
    .select('bio')
    .eq('id', req.userId!)
    .maybeSingle();
  const prevBio = prev?.bio ?? null;
  const nextBio = bio ?? null;
  const bioChanged = prevBio !== nextBio;

  const upsertPayload: Record<string, unknown> = {
    id: req.userId!,
    display_name,
    birth_date,
    gender,
    nationality,
    language,
    bio,
    interests: interests || [],
    updated_at: new Date().toISOString(),
  };
  // bio가 바뀌면 FE 폴링이 재합성 구간을 감지할 수 있도록 오디오 URL을 먼저 null로 리셋한다.
  if (bioChanged) upsertPayload.bio_audio_url = null;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(upsertPayload)
    .select()
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  // bio가 실제로 바뀐 경우에만 오디오 처리
  if (bioChanged && bio && data.elevenlabs_voice_id) {
    generateBioAudio(req.userId!, bio, data.elevenlabs_voice_id, language)
      .catch((err) => console.error('[Bio audio generation failed]', err));
  }

  res.json(data);
});

async function generateBioAudio(
  userId: string,
  bio: string,
  voiceId: string,
  _language: string
): Promise<void> {
  try {
    const audio = await synthesizeSpeech(bio, voiceId);
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
