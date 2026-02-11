import database from '../../../config/database';
import { PoolClient } from 'pg';
import { NotFoundError } from '../../../utils/errors';
import type { QueryExecutor } from '../../../types/database';
import {
  ResellerProfile,
  CreateResellerProfileData,
  UpdateResellerProfileDTO,
} from '../../../types';

class ResellerProfileRepository {
  /**
   * Cria um novo perfil de revendedor
   */
  async create(data: CreateResellerProfileData, client?: PoolClient): Promise<ResellerProfile> {
    const executor: QueryExecutor = client || database;

    const query = `
      INSERT INTO reseller_profiles (
        user_id, commission_rate, pix_key, max_discount_allowed, credit_limit
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      data.userId,
      data.commissionRate ?? 10.00,
      data.pixKey || null,
      data.maxDiscountAllowed ?? 0,
      data.creditLimit ?? 0,
    ];

    const result = await executor.query<ResellerProfile>(query, values);
    return result.rows[0];
  }

  /**
   * Busca perfil por user_id
   */
  async findByUserId(userId: string): Promise<ResellerProfile | null> {
    const query = `SELECT * FROM reseller_profiles WHERE user_id = $1`;
    const result = await database.query<ResellerProfile>(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Busca perfil por ID
   */
  async findById(id: string): Promise<ResellerProfile> {
    const query = `SELECT * FROM reseller_profiles WHERE id = $1`;
    const result = await database.query<ResellerProfile>(query, [id]);

    if (!result.rows[0]) {
      throw new NotFoundError('Perfil de revendedor nao encontrado');
    }

    return result.rows[0];
  }

  /**
   * Atualiza perfil de revendedor
   */
  async update(userId: string, data: UpdateResellerProfileDTO): Promise<ResellerProfile> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.commissionRate !== undefined) {
      updates.push(`commission_rate = $${paramIndex++}`);
      values.push(data.commissionRate);
    }

    if (data.pixKey !== undefined) {
      updates.push(`pix_key = $${paramIndex++}`);
      values.push(data.pixKey || null);
    }

    if (data.maxDiscountAllowed !== undefined) {
      updates.push(`max_discount_allowed = $${paramIndex++}`);
      values.push(data.maxDiscountAllowed);
    }

    if (data.creditLimit !== undefined) {
      updates.push(`credit_limit = $${paramIndex++}`);
      values.push(data.creditLimit);
    }

    if (updates.length === 0) {
      const existing = await this.findByUserId(userId);
      if (!existing) {
        throw new NotFoundError('Perfil de revendedor nao encontrado');
      }
      return existing;
    }

    values.push(userId);

    const query = `
      UPDATE reseller_profiles
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `;

    const result = await database.query<ResellerProfile>(query, values);

    if (!result.rows[0]) {
      throw new NotFoundError('Perfil de revendedor nao encontrado');
    }

    return result.rows[0];
  }

  /**
   * Remove perfil de revendedor
   */
  async delete(userId: string): Promise<void> {
    const query = `DELETE FROM reseller_profiles WHERE user_id = $1`;
    const result = await database.query(query, [userId]);

    if (result.rowCount === 0) {
      throw new NotFoundError('Perfil de revendedor nao encontrado');
    }
  }
}

export default new ResellerProfileRepository();
