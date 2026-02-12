import database from "../../../config/database";
import type { QueryExecutor } from "../../../types/database";
import type { TransactionContext } from "../types";
import { DomainError, ResourceNotFoundError } from "../domain/errors/DomainErrors";
import { buildPaginatedResponse, normalizePagination } from "../../../utils/pagination";
import {
  User,
  UserRole,
  UserStatus,
  CreateUserData,
  UpdateUserDTO,
  PaginationParams,
  UserListParams,
  PaginatedResponse,
} from "../../../types";

export class UserRepository {
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private asExecutor(ctx?: TransactionContext): QueryExecutor {
    return (ctx as QueryExecutor) || database;
  }

  async create(
    { name, email, passwordHash, role }: CreateUserData,
    ctx?: TransactionContext
  ): Promise<User> {
    const executor = this.asExecutor(ctx);
    const normalizedEmail = this.normalizeEmail(email);
    const query = `
      INSERT INTO users (name, email, password_hash, role, status)
      VALUES ($1, $2, $3, $4, 'ACTIVE')
      RETURNING id, name, email, role, status, created_at, updated_at
    `;

    const values = [name, normalizedEmail, passwordHash, role];
    const result = await executor.query<User>(query, values);

    return result.rows[0];
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    const query = `
      SELECT id, name, email, password_hash, role, status, failed_login_attempts, last_failed_login_at, locked_until, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await database.query<User>(query, [normalizedEmail]);
    return result.rows[0] || null;
  }

  // Alias para findByEmail (compatibilidade com inviteService)
  async findByEmailOrNull(email: string): Promise<User | null> {
    return this.findByEmail(email);
  }

  async findById(id: string): Promise<User> {
    const query = `
      SELECT id, name, email, role, status, failed_login_attempts, last_failed_login_at, locked_until, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await database.query<User>(query, [id]);

    if (!result.rows[0]) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }

    return result.rows[0];
  }

  async findByIdWithPassword(id: string): Promise<User> {
    const query = `
      SELECT id, name, email, password_hash, role, status, failed_login_attempts, last_failed_login_at, locked_until, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await database.query<User>(query, [id]);

    if (!result.rows[0]) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }

    return result.rows[0];
  }

  async findByIdOrNull(id: string): Promise<User | null> {
    const query = `
      SELECT id, name, email, role, status, failed_login_attempts, last_failed_login_at, locked_until, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await database.query<User>(query, [id]);
    return result.rows[0] || null;
  }

  async findAll({
    page,
    limit,
  }: PaginationParams): Promise<PaginatedResponse<User>> {
    const pagination = normalizePagination({ page, limit }, { limit: 10 });

    const query = `
      SELECT id, name, email, role, status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await database.query<User>(query, [pagination.limit, pagination.offset]);

    const countQuery = `SELECT COUNT(*) FROM users`;
    const countResult = await database.query<{ count: string }>(countQuery);

    const total = parseInt(countResult.rows[0].count, 10);

    return buildPaginatedResponse(result.rows, total, pagination.page, pagination.limit);
  }

  async findAllWithFilters({
    page,
    limit,
    role,
    status,
    search,
  }: UserListParams): Promise<PaginatedResponse<User>> {
    const pagination = normalizePagination({ page, limit }, { limit: 10 });
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(role);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const dataQuery = `
      SELECT id, name, email, role, status, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const result = await database.query<User>(dataQuery, [...values, pagination.limit, pagination.offset]);

    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await database.query<{ count: string }>(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    return buildPaginatedResponse(result.rows, total, pagination.page, pagination.limit);
  }

  async update(id: string, data: UpdateUserDTO): Promise<User> {
    const fields: string[] = [];
    const values: (string | UserRole | UserStatus)[] = [];
    let paramCount = 1;

    if (data.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (data.email) {
      fields.push(`email = $${paramCount++}`);
      values.push(this.normalizeEmail(data.email));
    }

    if (data.role) {
      fields.push(`role = $${paramCount++}`);
      values.push(data.role);
    }

    if (data.status) {
      fields.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    if (fields.length === 0) {
      throw new DomainError("Informe ao menos um campo para atualizar");
    }

    values.push(id);

    const query = `
      UPDATE users
      SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, name, email, role, status, created_at, updated_at
    `;

    const result = await database.query<User>(query, values);

    if (!result.rows[0]) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }

    return result.rows[0];
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    const query = `
      UPDATE users
      SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;

    const result = await database.query(query, [id]);

    if (!result.rows[0]) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }

    return { deleted: true };
  }

  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const normalizedEmail = this.normalizeEmail(email);
    let query = `SELECT id FROM users WHERE email = $1`;
    const params: string[] = [normalizedEmail];

    if (excludeId) {
      query += ` AND id != $2`;
      params.push(excludeId);
    }

    const result = await database.query(query, params);
    return result.rows.length > 0;
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    ctx?: TransactionContext
  ): Promise<void> {
    const executor = this.asExecutor(ctx);
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    const result = await executor.query(query, [passwordHash, userId]);

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }
  }

  async updateLoginFailures(
    userId: string,
    failedAttempts: number,
    lastFailedAt: Date,
    lockedUntil?: Date | null
  ): Promise<void> {
    const query = `
      UPDATE users
      SET failed_login_attempts = $1,
          last_failed_login_at = $2,
          locked_until = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `;

    const result = await database.query(query, [
      failedAttempts,
      lastFailedAt,
      lockedUntil ?? null,
      userId,
    ]);

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }
  }

  async registerFailedLoginAttempt(
    userId: string,
    maxAttempts: number,
    windowMinutes: number,
    lockMinutes: number
  ): Promise<{
    failedAttempts: number;
    lockedUntil: Date | null;
    locked: boolean;
  }> {
    const result = await database.query<{
      failed_login_attempts: number;
      locked_until: Date | null;
    }>(
      `
        UPDATE users
        SET failed_login_attempts = CASE
              WHEN locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP THEN failed_login_attempts
              WHEN (
                last_failed_login_at IS NULL
                OR last_failed_login_at <= CURRENT_TIMESTAMP - ($3::int * INTERVAL '1 minute')
              ) THEN CASE WHEN 1 >= $2 THEN 0 ELSE 1 END
              WHEN failed_login_attempts + 1 >= $2 THEN 0
              ELSE failed_login_attempts + 1
            END,
            last_failed_login_at = CASE
              WHEN locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP THEN last_failed_login_at
              ELSE CURRENT_TIMESTAMP
            END,
            locked_until = CASE
              WHEN locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP THEN locked_until
              WHEN (
                CASE
                  WHEN (
                    last_failed_login_at IS NULL
                    OR last_failed_login_at <= CURRENT_TIMESTAMP - ($3::int * INTERVAL '1 minute')
                  ) THEN 1
                  ELSE failed_login_attempts + 1
                END
              ) >= $2 THEN CURRENT_TIMESTAMP + ($4::int * INTERVAL '1 minute')
              ELSE NULL::timestamptz
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING failed_login_attempts, locked_until
      `,
      [userId, maxAttempts, windowMinutes, lockMinutes]
    );

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }

    const row = result.rows[0];
    return {
      failedAttempts: row.failed_login_attempts ?? 0,
      lockedUntil: row.locked_until ?? null,
      locked: Boolean(row.locked_until),
    };
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    const result = await database.query<{ is_locked: boolean }>(
      `
      SELECT (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) AS is_locked
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }

    return result.rows[0].is_locked;
  }

  async resetLoginLock(userId: string): Promise<void> {
    const query = `
      UPDATE users
      SET failed_login_attempts = 0,
          last_failed_login_at = NULL,
          locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const result = await database.query(query, [userId]);

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }
  }

  async lockAccount(userId: string, minutes: number): Promise<void> {
    const lockUntil = new Date(Date.now() + minutes * 60 * 1000);
    const result = await database.query(
      `UPDATE users
       SET locked_until = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [lockUntil, userId]
    );

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }
  }

  async unlockAccount(userId: string): Promise<void> {
    const result = await database.query(
      `UPDATE users
       SET locked_until = NULL,
           failed_login_attempts = 0,
           last_failed_login_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }
  }

  async updateRole(
    userId: string,
    role: UserRole,
    ctx?: TransactionContext
  ): Promise<void> {
    const executor = this.asExecutor(ctx);
    const query = `
      UPDATE users
      SET role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    const result = await executor.query(query, [role, userId]);

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }
  }

  async updateStatus(
    userId: string,
    status: UserStatus,
    ctx?: TransactionContext
  ): Promise<void> {
    const executor = this.asExecutor(ctx);
    const query = `
      UPDATE users
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    const result = await executor.query(query, [status, userId]);

    if (result.rowCount === 0) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }
  }
}

export default new UserRepository();
