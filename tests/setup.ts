import { vi } from 'vitest';

// env 모킹 - 다른 모듈보다 먼저 로드
vi.mock('../src/config/env', () => ({
  env: {
    port: 3000,
    nodeEnv: 'test',
    supabase: {
      url: 'https://test.supabase.co',
      serviceRoleKey: 'test-service-role-key',
      jwtSecret: 'test-jwt-secret-key-for-testing-purposes-only',
    },
    elevenlabs: {
      apiKey: 'test-elevenlabs-key',
    },
  },
}));

// Supabase mock helpers
export function createMockSupabaseQuery(returnData: any = null, returnError: any = null) {
  const chainable: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
    then: undefined as any,
  };
  // Make it thenable for await without .single()
  chainable.then = (resolve: any) => resolve({ data: returnData, error: returnError });
  return chainable;
}

export const mockFrom = vi.fn();
export const mockStorage = {
  from: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/photos/test.jpg' } }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  }),
};

export const mockRpc = vi.fn();

const mockAuth = {
  signInWithIdToken: vi.fn(),
  refreshSession: vi.fn(),
};

vi.mock('../src/config/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: mockAuth,
    storage: mockStorage,
  },
  supabaseAuth: {
    auth: mockAuth,
  },
}));

// ElevenLabs mock
vi.mock('../src/services/elevenlabs', () => ({
  createVoiceClone: vi.fn().mockResolvedValue('mock-voice-id'),
  deleteVoiceClone: vi.fn().mockResolvedValue(undefined),
  generateDubbedAudio: vi.fn().mockResolvedValue({
    audio: Buffer.from('mock-audio'),
    translatedText: 'translated text',
  }),
}));

// Storage mock
vi.mock('../src/services/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://test.supabase.co/storage/v1/object/public/photos/test.jpg'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  extractPath: vi.fn().mockReturnValue('test-user/test.jpg'),
}));

// Set test env
process.env.NODE_ENV = 'test';
