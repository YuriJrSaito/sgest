// src/modules/auth/repositories/refreshTokenRepository.ts
import database from '../../../config/database';
import { RefreshToken } from '../../../types';
import type { QueryExecutor } from '../../../types/database';
import type { TransactionContext } from '../types';
import { RefreshInProgressError } from '../domain/errors/AuthErrors';

export class RefreshTokenRepository {
  private getExecutor(ctx?: TransactionContext): QueryExecutor {
    return (ctx as QueryExecutor) || database;
  }

  /**
   * Cria um novo refresh token no banco de dados
   */
  async create(
    data: {
      userId: string;
      tokenHash: string;
      jti: string;
      familyId: string;
      expiresAt: Date;
      userAgent?: string;
      ipAddress?: string;
    },
    ctx?: TransactionContext
  ): Promise<RefreshToken> {
    const executor = this.getExecutor(ctx);
    const result = await executor.query<RefreshToken>(
      `INSERT INTO refresh_tokens (
        user_id, token_hash, jti, family_id, expires_at, user_agent, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.userId,
        data.tokenHash,
        data.jti,
        data.familyId,
        data.expiresAt,
        data.userAgent,
        data.ipAddress,
      ]
    );
    return result.rows[0];
  }

  /**
   * Busca um refresh token pelo JTI
   */
  async findByJti(jti: string, ctx?: TransactionContext): Promise<RefreshToken | null> {
    const executor = this.getExecutor(ctx);
    const result = await executor.query<RefreshToken>(
      'SELECT * FROM refresh_tokens WHERE jti = $1',
      [jti]
    );
    return result.rows[0] || null;
  }

  /**
   * Busca um refresh token pelo hash
   */
  async findByTokenHash(
    tokenHash: string,
    ctx?: TransactionContext
  ): Promise<RefreshToken | null> {
    const executor = this.getExecutor(ctx);
    const result = await executor.query<RefreshToken>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  /**
   * Busca um refresh token pelo hash com lock pessimista e timeout.
   * Encapsula SET LOCAL lock_timeout + SELECT FOR UPDATE + mapeamento de erro.
   * Deve ser chamado dentro de uma transacao.
   */
  async findByTokenHashWithLock(
    tokenHash: string,
    lockTimeoutMs: number,
    ctx: TransactionContext
  ): Promise<RefreshToken | null> {
    const executor = this.getExecutor(ctx);
    const safeTimeout = Math.max(0, Math.trunc(lockTimeoutMs));
    await executor.query(`SET LOCAL lock_timeout = '${safeTimeout}ms'`);

    try {
      const result = await executor.query<RefreshToken>(
        'SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE',
        [tokenHash]
      );
      return result.rows[0] || null;
    } catch (err) {
      if (this.isLockTimeoutError(err)) {
        throw new RefreshInProgressError();
      }
      throw err;
    }
  }

  /**
   * Busca todos os refresh tokens ativos de um usuario
   */
  async findActiveByUserId(userId: string, ctx?: TransactionContext): Promise<RefreshToken[]> {
    const executor = this.getExecutor(ctx);
    const result = await executor.query<RefreshToken>(
      'SELECT * FROM refresh_tokens WHERE user_id = $1 AND revoked = false AND expires_at > NOW() ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  /**
   * Revoga um refresh token especifico pelo JTI
   * Opcionalmente marca o JTI do token que o substituiu (para token rotation)
   */
  async revokeByJti(jti: string, replacedByJti?: string, ctx?: TransactionContext): Promise<void> {
    const executor = this.getExecutor(ctx);
    await executor.query(
      `UPDATE refresh_tokens
       SET revoked = true, revoked_at = NOW(), replaced_by_jti = $2
       WHERE jti = $1`,
      [jti, replacedByJti || null]
    );
  }

  /**
   * Revoga todos os refresh tokens de um usuario
   * Util para logout global ou mudanca de senha
   */
  async revokeAllByUserId(userId: string, ctx?: TransactionContext): Promise<void> {
    const executor = this.getExecutor(ctx);
    await executor.query(
      `UPDATE refresh_tokens
       SET revoked = true, revoked_at = NOW()
       WHERE user_id = $1 AND revoked = false`,
      [userId]
    );
  }

  /**
   * Revoga todos os tokens de uma familia (token rotation chain)
   * Detecta reutilizacao de tokens revogados (possivel ataque)
   */
  async revokeFamilyChain(familyId: string, ctx?: TransactionContext): Promise<void> {
    const executor = this.getExecutor(ctx);
    await executor.query(
      `UPDATE refresh_tokens
       SET revoked = true, revoked_at = NOW()
       WHERE family_id = $1`,
      [familyId]
    );
  }

  /**
   * Remove tokens expirados do banco de dados
   * Deve ser executado periodicamente (cron job)
   */
  async deleteExpired(): Promise<number> {
    const result = await database.query(
      `DELETE FROM refresh_tokens
       WHERE expires_at < NOW() - INTERVAL '7 days'`
    );
    return result.rowCount || 0;
  }

  private isLockTimeoutError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: string }).code;
    if (code === "55P03" || code === "57014") return true;
    const message = (err as { message?: string }).message || "";
    return message.includes("lock timeout") || message.includes("canceling statement due to lock timeout");
  }
}

export default new RefreshTokenRepository();
