export const envKeys = {
  DATABASE_URL: "DATABASE_URL",
  API_PORT: "API_PORT",
  WEB_PORT: "WEB_PORT",
  AI_SERVICE_PORT: "AI_SERVICE_PORT",
  JWT_SECRET: "JWT_SECRET",
  LINE_CHANNEL_SECRET: "LINE_CHANNEL_SECRET",
  LINE_CHANNEL_ACCESS_TOKEN: "LINE_CHANNEL_ACCESS_TOKEN",
  LINE_CHANNEL_ID: "LINE_CHANNEL_ID",
  OPENAI_API_KEY: "OPENAI_API_KEY",
  CHECKPOINT_DISABLE: "CHECKPOINT_DISABLE",
  NODE_ENV: "NODE_ENV",
} as const;

export const envExample = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/chatto_phase2?schema=public",
  API_PORT: "4000",
  WEB_PORT: "3000",
  AI_SERVICE_PORT: "5000",
  JWT_SECRET: "change-me-for-local-development",
  LINE_CHANNEL_SECRET: "phase-2-placeholder-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "phase-2-placeholder-token",
  LINE_CHANNEL_ID: "2010446906",
  OPENAI_API_KEY: "phase-2-placeholder-key",
  CHECKPOINT_DISABLE: "1",
  NODE_ENV: "development",
} as const;

export const defaultPorts = {
  api: 4000,
  web: 3000,
  aiService: 5000,
  postgres: 5432,
} as const;

export type SharedEnvKey = keyof typeof envKeys;
