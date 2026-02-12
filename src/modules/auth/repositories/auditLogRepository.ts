// src/modules/auth/repositories/auditLogRepository.ts
import database from '../../../config/database';
import { AuditLog, PaginationParams, PaginatedResponse } from '../../../types';
import { buildPaginatedResponse, normalizePagination } from '../../../utils/pagination';

export class AuditLogRepository {
  /**
   * Cria um novo registro de auditoria
   */
  async create(data: {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    status: 'success' | 'failure' | 'blocked';
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLog> {
    const result = await database.query<AuditLog>(
      `INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, status,
        ip_address, user_agent, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.userId || null,
        data.action,
        data.resourceType || null,
        data.resourceId || null,
        data.status,
        data.ipAddress || null,
        data.userAgent || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Busca logs de auditoria de um usuário com paginação
   */
  async findByUserId(
    userId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    const { page, limit, offset } = normalizePagination(pagination, { limit: 10 });

    // Buscar total de registros
    const countResult = await database.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM audit_logs WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Buscar registros paginados
    const result = await database.query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return buildPaginatedResponse(result.rows, total, page, limit);
  }

  async findLoginHistoryByUserId(
    userId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    const { page, limit, offset } = normalizePagination(pagination, { limit: 10 });

    const countResult = await database.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM audit_logs
       WHERE user_id = $1
         AND action IN ('login', 'login_failed')`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await database.query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE user_id = $1
         AND action IN ('login', 'login_failed')
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return buildPaginatedResponse(result.rows, total, page, limit);
  }

  /**
   * Busca os N últimos logins de um usuário
   */
  async findRecentLoginsByUserId(
    userId: string,
    limit: number = 10
  ): Promise<AuditLog[]> {
    const result = await database.query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE user_id = $1 AND action IN ('login', 'login_failed')
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  /**
   * Busca logs por ação específica
   */
  async findByAction(
    action: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    const { page, limit, offset } = normalizePagination(pagination, { limit: 10 });

    const countResult = await database.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM audit_logs WHERE action = $1',
      [action]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await database.query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE action = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [action, limit, offset]
    );

    return buildPaginatedResponse(result.rows, total, page, limit);
  }

  /**
   * Busca tentativas de login por IP
   */
  async findByIpAddress(
    ipAddress: string,
    limit: number = 20
  ): Promise<AuditLog[]> {
    const result = await database.query<AuditLog>(
      `SELECT * FROM audit_logs
       WHERE ip_address = $1 AND action IN ('login', 'login_failed')
       ORDER BY created_at DESC
       LIMIT $2`,
      [ipAddress, limit]
    );
    return result.rows;
  }

  /**
   * Remove logs antigos (mais de 90 dias)
   */
  async deleteOld(daysToKeep: number = 90): Promise<number> {
    const result = await database.query(
      `DELETE FROM audit_logs
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [daysToKeep]
    );
    return result.rowCount || 0;
  }

  /**
   * Estatísticas de auditoria por usuário
   */
  async getStatsByUserId(userId: string): Promise<{
    totalLogins: number;
    failedLogins: number;
    lastLogin?: Date;
    lastIpAddress?: string;
  }> {
    const result = await database.query<{
      total_logins: string;
      failed_logins: string;
      last_login: Date;
      last_ip: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE action = 'login' AND status = 'success') as total_logins,
        COUNT(*) FILTER (WHERE action = 'login_failed') as failed_logins,
        MAX(created_at) FILTER (WHERE action = 'login' AND status = 'success') as last_login,
        (SELECT ip_address FROM audit_logs
         WHERE user_id = $1 AND action = 'login' AND status = 'success'
         ORDER BY created_at DESC LIMIT 1) as last_ip
       FROM audit_logs
       WHERE user_id = $1`,
      [userId]
    );

    const row = result.rows[0];
    return {
      totalLogins: parseInt(row.total_logins || '0', 10),
      failedLogins: parseInt(row.failed_logins || '0', 10),
      lastLogin: row.last_login,
      lastIpAddress: row.last_ip,
    };
  }
}

export default new AuditLogRepository();
