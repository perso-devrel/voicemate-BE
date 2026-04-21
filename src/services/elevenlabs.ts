import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { env } from '../config/env';
import { Emotion } from '../types';

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

export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  emotion?: Exclude<Emotion, 'neutral'> | null
): Promise<Buffer> {
  const prefixed = emotion ? `[${emotion}] ${text}` : text;
  const audioStream = await client.textToSpeech.convert(voiceId, {
    text: prefixed,
    modelId: 'eleven_v3',
    voiceSettings: { stability: 0.4 },
  });
  return streamToBuffer(audioStream);
}
