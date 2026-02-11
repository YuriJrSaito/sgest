// src/server.ts
import 'reflect-metadata';
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { env } from './config/env';
import { loggerConfig, setLogger, getHttpLogger } from './config/logger';
import redis, { checkRedisConnection, closeRedis } from './config/redis';
import { errorHandler } from './utils/errors';
import { startCleanupScheduler } from './utils/cleanup';
import authRoutes from './modules/auth/routes';
import inviteRoutes from './modules/invites/routes';
import productRoutes from './modules/product/routes';
import notificationRoutes from './modules/notifications/routes';
import kitRoutes, { kitItemRoutes } from './modules/kits/routes';
import userRoutes from './modules/users/routes';
import permissionRoutes from './modules/permissions/routes';
import sseManager from './modules/notifications/sse/sseManager';

let cleanupTimer: NodeJS.Timeout | null = null;
const BURST_LIMIT_WINDOW_MS = Number(process.env.BURST_RATE_WINDOW_MS) || 5_000;
const BURST_LIMIT_MAX = Number(process.env.BURST_RATE_MAX) || (process.env.NODE_ENV === 'development' ? 120 : 60);
const burstBuckets = new Map<string, { count: number; resetAt: number }>();

const app = Fastify({
  logger: loggerConfig,
  ajv: {
    customOptions: {
      coerceTypes: true, // Converte query params automaticamente (string → number)
    },
  },
});

// Injeta o logger do Fastify como logger principal da aplicacao
setLogger(app.log);

async function registerPlugins() {
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cookie, {
    secret: env.JWT_SECRET, // usado para assinar cookies se necessário
    parseOptions: {},
  });

  await app.register(rateLimit, {
    max: env.NODE_ENV === 'development' ? 1000 : 100,
    timeWindow: '15 minutes',
    redis,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    errorResponseBuilder: (_request, context) => ({
      status: 'error',
      message: `Rate limit exceeded, retry in ${Math.ceil(context.ttl / 1000)} seconds`,
    }),
  });
}

async function registerRoutes() {
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/notifications/stream')) return;

    const now = Date.now();
    const key = request.ip;
    const current = burstBuckets.get(key);
    if (!current || current.resetAt <= now) {
      burstBuckets.set(key, { count: 1, resetAt: now + BURST_LIMIT_WINDOW_MS });
      return;
    }

    current.count += 1;
    if (current.count > BURST_LIMIT_MAX) {
      return reply.code(429).send({
        status: 'error',
        message: 'Muitas requisicoes. Tente novamente mais tarde',
      });
    }
  });

  app.get('/health', async () => {
    const redisOk = await checkRedisConnection();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        redis: redisOk ? 'ok' : 'error',
      },
    };
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(inviteRoutes, { prefix: '/api/invites' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(permissionRoutes, { prefix: '/api/permissions' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(kitRoutes, { prefix: '/api/kits' });
  await app.register(kitItemRoutes, { prefix: '/api/kit-items' });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      status: 'error',
      message: 'Rota não encontrada',
    });
  });
}

app.setErrorHandler(errorHandler);

async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    const HOST = '0.0.0.0';

    await app.listen({ port: env.PORT, host: HOST });

    // Iniciar limpeza automática de tokens (a cada 24 horas)
    if (env.NODE_ENV !== 'test') {
      cleanupTimer = startCleanupScheduler(24);
    }

    getHttpLogger().info({
      port: env.PORT,
      environment: env.NODE_ENV,
      healthCheck: `http://localhost:${env.PORT}/health`,
    }, 'Servidor iniciado');

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const shutdown = async () => {
  getHttpLogger().info('Encerrando servidor...');
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  await sseManager.shutdown();
  await closeRedis();
  await app.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();