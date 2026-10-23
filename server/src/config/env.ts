import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'inkloom_guardian_jwt_secret_default_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  llm: {
    provider: (process.env.LLM_PROVIDER || 'mock').toLowerCase(),
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.LLM_MODEL || 'default',
  },
  maxUploadSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
};

if (config.nodeEnv === 'production' && config.jwtSecret.includes('default')) {
  console.warn(
    '[SECURITY AUDIT ALERT] Application is running in production with a default JWT_SECRET. Configure a cryptographically secure 256-bit secret in the JWT_SECRET environment variable before exposing to public networks.'
  );
}
