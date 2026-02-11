// src/modules/auth/repositories/tokenBlacklistRepository.ts
import database from '../../../config/database';
import redis from '../../../config/redis';
import { TokenBlacklist } from '../../../types';
import type { QueryExecutor } from '../../../types/database';
import { getAuthLogger } from '../../../config/logger';
import { env } from '../../../config/env';
import type { TransactionContext } from '../types';

const BLACKLIST_PREFIX = 'blacklist:';

export class TokenBlacklistRepository {
  private asExecutor(ctx?: TransactionContext): QueryExecutor {
    return (ctx as QueryExecutor) || database;
  }

  /**
   * Adiciona um token à blacklist (revogação)
   * Redis: Cache rápido com TTL automático
   * PostgreSQL: Persistência para auditoria
   */
  async add(data: {
    jti: string;
    userId: string;
    tokenHash: string;
    reason: string;
    expiresAt: Date;
  }, ctx?: TransactionContext): Promise<void> {
    const executor = this.asExecutor(ctx);

    // Calcula TTL em segundos (tempo até expiração do token)
    const ttlSeconds = Math.max(
      Math.ceil((data.expiresAt.getTime() - Date.now()) / 1000),
      1 // Mínimo 1 segundo
    );

    // Quando chamado dentro de transacao, persiste apenas no Postgres para manter rollback consistente.
    if (!ctx) {
      // Redis: Cache com TTL (auto-expira quando token expira)
      try {
        await redis.setex(`${BLACKLIST_PREFIX}${data.jti}`, ttlSeconds, '1');
        getAuthLogger().debug({ jti: data.jti, ttl: ttlSeconds }, 'Token adicionado à blacklist Redis');
      } catch (err) {
        getAuthLogger().error({ err, jti: data.jti }, 'Erro ao adicionar token ao Redis, usando fallback PostgreSQL');
      }
    }

    // PostgreSQL: Persistência para auditoria/histórico
    await executor.query(
      `INSERT INTO token_blacklist (jti, user_id, token_hash, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (jti) DO NOTHING`,
      [data.jti, data.userId, data.tokenHash, data.reason, data.expiresAt]
    );
  }

  /**
   * Verifica se um token está na blacklist pelo JTI
   * Prioriza Redis (rápido) com fallback para PostgreSQL
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    // Primeiro tenta Redis (< 1ms)
    try {
      const cached = await redis.get(`${BLACKLIST_PREFIX}${jti}`);
      if (cached === '1') return true;
    } catch (err) {
      getAuthLogger().warn({ err, jti }, 'Redis indisponível, usando fallback PostgreSQL');
      return await this.checkPostgresAndSync(jti);
    }

    // Se não está no Redis, verifica PostgreSQL (pode ter sido adicionado antes do Redis)
    // Isso garante consistência em caso de restart do Redis
    return await this.checkPostgresAndSync(jti);
  }

  private async checkPostgresAndSync(jti: string): Promise<boolean> {
    try {
      const result = await database.query<{ expires_at: Date }>(
        'SELECT expires_at FROM token_blacklist WHERE jti = $1 AND expires_at > NOW() LIMIT 1',
        [jti]
      );

      if (result.rowCount && result.rowCount > 0) {
        const expiresAt = result.rows[0]?.expires_at;
        if (expiresAt) {
          const ttl = Math.max(
            Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
            1
          );
          try {
            await redis.setex(`${BLACKLIST_PREFIX}${jti}`, ttl, '1');
          } catch {
            // Ignora erro de cache
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isConnectTimeout = message.includes('timeout exceeded when trying to connect');
      if (env.NODE_ENV !== 'production' && isConnectTimeout) {
        getAuthLogger().warn({ err, jti }, 'PostgreSQL indisponível no blacklist check; liberando em dev');
        return false;
      }
      if (typeof (err as { statusCode?: unknown }).statusCode !== 'number') {
        (err as { statusCode: number }).statusCode = 503;
      }
      getAuthLogger().error({ err, jti }, 'Erro ao consultar blacklist no PostgreSQL');
      throw err;
    }
  }

  async deleteExpired(): Promise<number> {
    const result = await database.query(
      `DELETE FROM token_blacklist
       WHERE expires_at < NOW() - INTERVAL '7 days'`
    );
    return result.rowCount || 0;
  }

  /**
   * Obtém informações de um token na blacklist
   */
  async findByJti(jti: string): Promise<TokenBlacklist | null> {
    const result = await database.query<TokenBlacklist>(
      'SELECT * FROM token_blacklist WHERE jti = $1',
      [jti]
    );
    return result.rows[0] || null;
  }
}

export default new TokenBlacklistRepository();
