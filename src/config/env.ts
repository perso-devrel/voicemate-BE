import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    jwtSecret: required('SUPABASE_JWT_SECRET'),
  },

  elevenlabs: {
    apiKey: required('ELEVENLABS_API_KEY'),
  },

  vertexAi: {
    projectId: required('GCP_PROJECT_ID'),
    location: process.env.GCP_LOCATION || 'us-central1',
  },
};
