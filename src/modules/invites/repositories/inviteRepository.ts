import { PoolClient } from 'pg';
import database from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import {
  Invite,
  InviteWithCreator,
  CreateInviteData,
  InviteListParams,
  PaginatedResponse,
} from '../../../types';
import type { QueryExecutor } from '../../../types/database';
import { buildPaginatedResponse, normalizePagination } from '../../../utils/pagination';

class InviteRepository {
  /**
   * Cria um novo convite
   */
  async create(data: CreateInviteData, client?: PoolClient): Promise<Invite> {
    const executor: QueryExecutor = client || database;
    const query = `
      INSERT INTO invites (email, token, role_to_assign, commission_rate, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      data.email,
      data.token,
      data.roleToAssign,
      data.commissionRate ?? null,
      data.expiresAt,
      data.createdBy,
    ];

    const result = await executor.query<Invite>(query, values);
    return result.rows[0];
  }

  /**
   * Busca convite por token
   */
  async findByToken(token: string): Promise<Invite> {
    const query = `SELECT * FROM invites WHERE token = $1`;
    const result = await database.query<Invite>(query, [token]);

    if (!result.rows[0]) {
      throw new NotFoundError('Convite nao encontrado');
    }

    return result.rows[0];
  }

  /**
   * Busca convite por token (retorna null se nao encontrar)
   */
  async findByTokenOrNull(token: string): Promise<Invite | null> {
    const query = `SELECT * FROM invites WHERE token = $1`;
    const result = await database.query<Invite>(query, [token]);
    return result.rows[0] || null;
  }

  /**
   * Busca convite por token com lock (uso em transacao)
   */
  async findByTokenForUpdate(token: string, client: PoolClient): Promise<Invite | null> {
    const query = `SELECT * FROM invites WHERE token = $1 FOR UPDATE`;
    const result = await client.query<Invite>(query, [token]);
    return result.rows[0] || null;
  }

  /**
   * Busca convite por ID
   */
  async findById(id: string): Promise<Invite> {
    const query = `SELECT * FROM invites WHERE id = $1`;
    const result = await database.query<Invite>(query, [id]);

    if (!result.rows[0]) {
      throw new NotFoundError('Convite nao encontrado');
    }

    return result.rows[0];
  }

  /**
   * Busca convite pendente por email
   */
  async findPendingByEmail(email: string): Promise<Invite | null> {
    const query = `
      SELECT * FROM invites
      WHERE email = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await database.query<Invite>(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Lista convites com filtros e paginacao
   */
  async findAll(params: InviteListParams): Promise<PaginatedResponse<InviteWithCreator>> {
    const { page, limit, offset } = normalizePagination(params, { limit: 10 });

    let whereClause = 'WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    // Filtro por status
    if (params.status === 'pending') {
      whereClause += ` AND i.used_at IS NULL AND i.expires_at > NOW()`;
    } else if (params.status === 'used') {
      whereClause += ` AND i.used_at IS NOT NULL`;
    } else if (params.status === 'expired') {
      whereClause += ` AND i.used_at IS NULL AND i.expires_at <= NOW()`;
    }

    // Filtro por email
    if (params.email) {
      whereClause += ` AND i.email ILIKE $${paramIndex++}`;
      values.push(`%${params.email}%`);
    }

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM invites i
      ${whereClause}
    `;
    const countResult = await database.query<{ total: string }>(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Query para buscar dados com join no criador
    const dataQuery = `
      SELECT
        i.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        ) as creator
      FROM invites i
      JOIN users u ON i.created_by = u.id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    values.push(limit, offset);

    const dataResult = await database.query<InviteWithCreator>(dataQuery, values);

    return buildPaginatedResponse(dataResult.rows, total, page, limit);
  }

  /**
   * Marca convite como usado
   */
  async markAsUsed(id: string): Promise<Invite> {
    const query = `
      UPDATE invites
      SET used_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await database.query<Invite>(query, [id]);

    if (!result.rows[0]) {
      throw new NotFoundError('Convite nao encontrado');
    }

    return result.rows[0];
  }

  /**
   * Atualiza token e expiracao (para reenvio)
   */
  async updateToken(id: string, token: string, expiresAt: Date): Promise<Invite> {
    const query = `
      UPDATE invites
      SET token = $1, expires_at = $2, used_at = NULL
      WHERE id = $3
      RETURNING *
    `;

    const result = await database.query<Invite>(query, [token, expiresAt, id]);

    if (!result.rows[0]) {
      throw new NotFoundError('Convite nao encontrado');
    }

    return result.rows[0];
  }

  /**
   * Remove convite
   */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM invites WHERE id = $1`;
    const result = await database.query(query, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundError('Convite nao encontrado');
    }
  }

  /**
   * Remove convites expirados nao utilizados
   */
  async deleteExpired(): Promise<number> {
    const query = `
      DELETE FROM invites
      WHERE used_at IS NULL AND expires_at < NOW()
    `;
    const result = await database.query(query);
    return result.rowCount || 0;
  }

  /**
   * Invalida convites pendentes anteriores para o mesmo email
   */
  async invalidatePreviousInvites(email: string, client?: PoolClient): Promise<void> {
    const executor: QueryExecutor = client || database;
    const query = `
      DELETE FROM invites
      WHERE email = $1
        AND used_at IS NULL
    `;
    await executor.query(query, [email]);
  }
}

export default new InviteRepository();
