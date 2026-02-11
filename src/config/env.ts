// src/config/env.ts

interface Env {
  NODE_ENV: string;
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  MAX_LOGIN_ATTEMPTS: number;
  LOGIN_ATTEMPT_WINDOW_MINUTES: number;
  ACCOUNT_LOCK_DURATION_MINUTES: number;
  FRONTEND_URL: string;
  EMAIL_PROVIDER: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  ETHEREAL_USER: string;
  ETHEREAL_PASS: string;
}

function validateEnv(): Env {
  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'FRONTEND_URL'
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`
    );
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 3000,
    DB_HOST: process.env.DB_HOST!,
    DB_PORT: Number(process.env.DB_PORT),
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    DB_NAME: process.env.DB_NAME!,
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    MAX_LOGIN_ATTEMPTS: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    LOGIN_ATTEMPT_WINDOW_MINUTES: Number(process.env.LOGIN_ATTEMPT_WINDOW_MINUTES) || 15,
    ACCOUNT_LOCK_DURATION_MINUTES: Number(process.env.ACCOUNT_LOCK_DURATION_MINUTES) || 30,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'ethereal',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@sgest.local',
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'SGest',
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    ETHEREAL_USER: process.env.ETHEREAL_USER || '',
    ETHEREAL_PASS: process.env.ETHEREAL_PASS || '',
  };
}

export const env = validateEnv();
