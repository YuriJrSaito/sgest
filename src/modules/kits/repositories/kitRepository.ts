import { PoolClient } from 'pg';
import database from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import type { QueryExecutor } from '../../../types/database';
import { buildPaginatedResponse, normalizePagination } from '../../../utils/pagination';
import {
  Kit,
  KitWithDetails,
  KitStatus,
  KitListParams,
  PaginatedResponse,
} from '../../../types';

class KitRepository {
  /**
   * Gera o proximo codigo sequencial (KIT-001, KIT-002, ...)
   */
  async generateCode(client?: PoolClient): Promise<string> {
    const executor: QueryExecutor = client || database;
    const query = `
      SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0) + 1 as next_num
      FROM kits
    `;
    const result = await executor.query<{ next_num: number }>(query);
    const num = result.rows[0].next_num;
    return `KIT-${String(num).padStart(3, '0')}`;
  }

  /**
   * Cria um novo kit
   */
  async create(data: { code: string; name: string; description?: string; createdBy: string }, client?: PoolClient): Promise<Kit> {
    const executor: QueryExecutor = client || database;
    const query = `
      INSERT INTO kits (code, name, description, status, created_by)
      VALUES ($1, $2, $3, 'draft', $4)
      RETURNING *
    `;
    const values = [data.code, data.name, data.description || null, data.createdBy];
    const result = await executor.query<Kit>(query, values);
    return result.rows[0];
  }

  /**
   * Busca kit por ID
   */
  async findById(id: string): Promise<Kit> {
    const query = `SELECT * FROM kits WHERE id = $1`;
    const result = await database.query<Kit>(query, [id]);
    if (!result.rows[0]) {
      throw new NotFoundError('Kit nao encontrado');
    }
    return result.rows[0];
  }

  /**
   * Busca kit por ID com lock para transacao
   */
  async findByIdForUpdate(id: string, client: PoolClient): Promise<Kit | null> {
    const query = `SELECT * FROM kits WHERE id = $1 FOR UPDATE`;
    const result = await client.query<Kit>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Busca kit com detalhes (reseller name, item count, total value)
   */
  async findByIdWithDetails(id: string): Promise<KitWithDetails> {
    const query = `
      SELECT k.*,
        u.name as reseller_name,
        COALESCE(items.item_count, 0)::int as item_count,
        COALESCE(items.total_value, 0)::numeric as total_value
      FROM kits k
      LEFT JOIN users u ON k.reseller_id = u.id
      LEFT JOIN (
        SELECT kit_id,
          SUM(quantity)::int as item_count,
          SUM(quantity * unit_price)::numeric as total_value
        FROM kit_items
        GROUP BY kit_id
      ) items ON items.kit_id = k.id
      WHERE k.id = $1
    `;
    const result = await database.query<KitWithDetails>(query, [id]);
    if (!result.rows[0]) {
      throw new NotFoundError('Kit nao encontrado');
    }
    return result.rows[0];
  }

  /**
   * Lista kits com paginacao e filtros
   */
  async findAll(params: KitListParams = {}): Promise<PaginatedResponse<KitWithDetails>> {
    const { status, resellerId, search } = params;
    const { page, limit, offset } = normalizePagination(params, { limit: 20 });

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`k.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (resellerId) {
      conditions.push(`k.reseller_id = $${paramIndex}`);
      values.push(resellerId);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(k.code ILIKE $${paramIndex} OR k.name ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count
    const countQuery = `SELECT COUNT(*) as total FROM kits k ${where}`;
    const countResult = await database.query<{ total: string }>(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Data
    const dataQuery = `
      SELECT k.*,
        u.name as reseller_name,
        COALESCE(items.item_count, 0)::int as item_count,
        COALESCE(items.total_value, 0)::numeric as total_value
      FROM kits k
      LEFT JOIN users u ON k.reseller_id = u.id
      LEFT JOIN (
        SELECT kit_id,
          SUM(quantity)::int as item_count,
          SUM(quantity * unit_price)::numeric as total_value
        FROM kit_items
        GROUP BY kit_id
      ) items ON items.kit_id = k.id
      ${where}
      ORDER BY k.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await database.query<KitWithDetails>(dataQuery, [...values, limit, offset]);

    return buildPaginatedResponse(dataResult.rows, total, page, limit);
  }

  /**
   * Atualiza campos do kit
   */
  async update(id: string, data: { name?: string; description?: string; notes?: string }, client?: PoolClient): Promise<Kit> {
    const executor: QueryExecutor = client || database;
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      sets.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
    }
    if (data.description !== undefined) {
      sets.push(`description = $${paramIndex}`);
      values.push(data.description);
      paramIndex++;
    }
    if (data.notes !== undefined) {
      sets.push(`notes = $${paramIndex}`);
      values.push(data.notes);
      paramIndex++;
    }

    if (sets.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `UPDATE kits SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await executor.query<Kit>(query, values);
    if (!result.rows[0]) {
      throw new NotFoundError('Kit nao encontrado');
    }
    return result.rows[0];
  }

  /**
   * Atualiza o status do kit
   */
  async updateStatus(id: string, status: KitStatus, client: PoolClient): Promise<Kit> {
    const extras: string[] = [`status = $2`];
    if (status === 'returned') {
      extras.push(`returned_at = CURRENT_TIMESTAMP`);
    }
    if (status === 'draft') {
      extras.push(`returned_at = NULL`);
    }

    const query = `UPDATE kits SET ${extras.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await client.query<Kit>(query, [id, status]);
    if (!result.rows[0]) {
      throw new NotFoundError('Kit nao encontrado');
    }
    return result.rows[0];
  }

  /**
   * Atribui revendedor ao kit
   */
  async assign(id: string, resellerId: string, client?: PoolClient): Promise<Kit> {
    const executor: QueryExecutor = client || database;
    const query = `
      UPDATE kits SET reseller_id = $2, assigned_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `;
    const result = await executor.query<Kit>(query, [id, resellerId]);
    if (!result.rows[0]) {
      throw new NotFoundError('Kit nao encontrado');
    }
    return result.rows[0];
  }

  /**
   * Remove revendedor do kit
   */
  async unassign(id: string, client?: PoolClient): Promise<Kit> {
    const executor: QueryExecutor = client || database;
    const query = `
      UPDATE kits SET reseller_id = NULL, assigned_at = NULL
      WHERE id = $1 RETURNING *
    `;
    const result = await executor.query<Kit>(query, [id]);
    if (!result.rows[0]) {
      throw new NotFoundError('Kit nao encontrado');
    }
    return result.rows[0];
  }

  /**
   * Deleta um kit (apenas draft)
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM kits WHERE id = $1 AND status = 'draft'`;
    const result = await database.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }
}

export default new KitRepository();
