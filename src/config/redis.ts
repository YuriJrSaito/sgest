import Redis from 'ioredis';
import { getDbLogger } from './logger';

const isTest = process.env.NODE_ENV === 'test';

// Configuração do Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryStrategy: (times: number) => {
    // Backoff exponencial com máximo de 30s entre tentativas
    return Math.min(times * 100, 30000);
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: isTest, // Em testes, não conecta automaticamente
};

// Instância do Redis
const redis = new Redis(redisConfig);

// Event handlers para logging
redis.on('connect', () => {
  getDbLogger().info('Redis: Conectando...');
});

redis.on('ready', () => {
  getDbLogger().info({ host: redisConfig.host, port: redisConfig.port, db: redisConfig.db }, 'Redis: Pronto');
});

redis.on('error', (err) => {
  getDbLogger().error({ err }, 'Redis: Erro de conexão');
});

redis.on('close', () => {
  getDbLogger().warn('Redis: Conexão fechada');
});

redis.on('reconnecting', () => {
  getDbLogger().info('Redis: Reconectando...');
});

// Função para verificar conexão
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (err) {
    getDbLogger().error({ err }, 'Redis: Falha no health check');
    return false;
  }
}

// Graceful Shutdown
export async function closeRedis(): Promise<void> {
  await redis.quit();
  getDbLogger().info('Redis: Conexão encerrada');
}

export default redis;
