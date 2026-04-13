import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { env } from '../config/env';

const client = new ElevenLabsClient({ apiKey: env.elevenlabs.apiKey });

export async function createVoiceClone(
  userId: string,
  audioBuffer: Buffer,
  fileName: string
): Promise<string> {
  const audioBlob = new Blob([audioBuffer as unknown as Uint8Array<ArrayBuffer>], { type: 'audio/wav' });
  const file = new File([audioBlob], fileName, { type: 'audio/wav' });

  const voice = await client.voices.ivc.create({
    name: `user_${userId}`,
    files: [file],
    removeBackgroundNoise: true,
  });

  return voice.voiceId;
}

export async function deleteVoiceClone(voiceId: string): Promise<void> {
  await client.voices.delete(voiceId);
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function generateDubbedAudio(
  text: string,
  voiceId: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<{ audio: Buffer; translatedText: string | null }> {
  // 같은 언어면 번역 없이 TTS만
  if (sourceLanguage === targetLanguage) {
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: 'eleven_multilingual_v2',
    });

    const audio = await streamToBuffer(audioStream);
    return { audio, translatedText: text };
  }

  // 다른 언어: 먼저 TTS로 소스 오디오 생성 후 Dubbing API로 번역+더빙
  const sourceAudioStream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: 'eleven_multilingual_v2',
  });

  const sourceAudio = await streamToBuffer(sourceAudioStream);

  // Dubbing API로 타겟 언어로 더빙
  const sourceBlob = new Blob([sourceAudio as unknown as Uint8Array<ArrayBuffer>], { type: 'audio/mpeg' });
  const sourceFile = new File([sourceBlob], 'source.mp3', { type: 'audio/mpeg' });

  const dubbing = await client.dubbing.create({
    file: sourceFile,
    sourceLang: sourceLanguage,
    targetLang: targetLanguage,
  });

  const dubbingId = dubbing.dubbingId;

  // 더빙 완료 대기 (polling, 최대 10분)
  const MAX_POLLS = 300;
  let polls = 0;
  let dubbingStatus = '';
  while (polls < MAX_POLLS) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const metadata = await client.dubbing.get(dubbingId);
    dubbingStatus = metadata.status;

    if (dubbingStatus === 'dubbed') break;
    if (dubbingStatus === 'failed') {
      throw new Error('Dubbing failed');
    }
    polls++;
  }
  if (dubbingStatus !== 'dubbed') {
    throw new Error('Dubbing timed out after 10 minutes');
  }

  // 더빙된 오디오 다운로드
  const dubbedResponse = await client.dubbing.audio.get(dubbingId, targetLanguage);
  const dubbedAudio = await streamToBuffer(dubbedResponse);

  // 번역 텍스트 추출 (Dubbing API transcript 엔드포인트)
  let translatedText: string | null = null;
  try {
    const transcript = await client.dubbing.transcript.getTranscriptForDub(dubbingId, targetLanguage);
    if (typeof transcript === 'string') {
      translatedText = transcript;
    } else if (transcript && 'utterances' in transcript) {
      translatedText = transcript.utterances
        .map((u: { text?: string }) => u.text || '')
        .join(' ')
        .trim() || null;
    }
  } catch {
    // transcript 추출 실패 시 null 유지 — 오디오 더빙은 정상 완료됨
  }

  return { audio: dubbedAudio, translatedText };
}
