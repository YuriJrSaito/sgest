// src/__tests__/setup.ts
import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variaveis de ambiente de teste ANTES de qualquer import
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

// Mock do Redis ANTES de importar qualquer modulo que o use
jest.mock('../config/redis', () => {
  const store: Map<string, { value: string; expiresAt?: number }> = new Map();

  return {
    __esModule: true,
    default: {
      setex: jest.fn(async (key: string, seconds: number, value: string) => {
        store.set(key, {
          value,
          expiresAt: Date.now() + seconds * 1000,
        });
        return 'OK';
      }),
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, { value });
        return 'OK';
      }),
      get: jest.fn(async (key: string) => {
        const item = store.get(key);
        if (!item) return null;
        if (item.expiresAt && item.expiresAt < Date.now()) {
          store.delete(key);
          return null;
        }
        return item.value;
      }),
      exists: jest.fn(async (key: string) => {
        const item = store.get(key);
        if (!item) return 0;
        if (item.expiresAt && item.expiresAt < Date.now()) {
          store.delete(key);
          return 0;
        }
        return 1;
      }),
      del: jest.fn(async (key: string) => {
        const existed = store.has(key);
        store.delete(key);
        return existed ? 1 : 0;
      }),
      ping: jest.fn(async () => 'PONG'),
      quit: jest.fn(async () => 'OK'),
      on: jest.fn(),
    },
    checkRedisConnection: jest.fn(async () => true),
    closeRedis: jest.fn(async () => {}),
  };
});

// Aumentar timeout global
if (typeof jest !== 'undefined') {
  jest.setTimeout(30000);
}

// Silenciar logs durante os testes
if (typeof global !== 'undefined') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Manter warn e error para debug
    // warn: jest.fn(),
    // error: jest.fn(),
  };
}

// Cleanup apos todos os testes
afterAll(async () => {
  // Fechar conexoes do banco se necessario
  try {
    const database = require('../config/database').default;
    await database.close();
  } catch (_err) {
    // Ignorar erros de cleanup
  }
});
