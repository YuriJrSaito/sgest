import { PoolClient } from 'pg';
import database from '../../../config/database';
import {
  Notification,
  CreateNotificationData,
  NotificationListParams,
  PaginatedResponse,
} from '../../../types';
import type { QueryExecutor } from '../../../types/database';
import { buildPaginatedResponse, normalizePagination } from '../../../utils/pagination';

class NotificationRepository {
  /**
   * Cria uma nova notificacao
   */
  async create(data: CreateNotificationData, client?: PoolClient): Promise<Notification> {
    const executor: QueryExecutor = client || database;
    const query = `
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      data.userId,
      data.type,
      data.title,
      data.message,
      JSON.stringify(data.data || {}),
    ];

    const result = await executor.query<Notification>(query, values);
    return result.rows[0];
  }

  /**
   * Cria notificacoes em lote (para broadcast)
   */
  async createBatch(notifications: CreateNotificationData[], client?: PoolClient): Promise<Notification[]> {
    if (notifications.length === 0) return [];

    const executor: QueryExecutor = client || database;

    const values: unknown[] = [];
    const placeholders: string[] = [];

    notifications.forEach((n, i) => {
      const offset = i * 5;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      values.push(n.userId, n.type, n.title, n.message, JSON.stringify(n.data || {}));
    });

    const query = `
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await executor.query<Notification>(query, values);
    return result.rows;
  }

  /**
   * Lista notificacoes de um usuario com paginacao e filtros
   */
  async findByUserId(userId: string, params: NotificationListParams = {}): Promise<PaginatedResponse<Notification>> {
    const { read, type } = params;
    const { page, limit, offset } = normalizePagination(params, { limit: 20 });

    const conditions: string[] = ['user_id = $1'];
    const values: unknown[] = [userId];
    let paramIndex = 2;

    if (read !== undefined) {
      conditions.push(`read = $${paramIndex}`);
      values.push(read);
      paramIndex++;
    }

    if (type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }

    const where = conditions.join(' AND ');

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM notifications WHERE ${where}`;
    const countResult = await database.query<{ total: string }>(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Fetch data
    const dataQuery = `
      SELECT * FROM notifications
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await database.query<Notification>(dataQuery, [...values, limit, offset]);

    return buildPaginatedResponse(dataResult.rows, total, page, limit);
  }

  /**
   * Conta notificacoes nao lidas de um usuario
   */
  async countUnread(userId: string): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = FALSE`;
    const result = await database.query<{ count: string }>(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Marca uma notificacao como lida
   */
  async markAsRead(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE notifications SET read = TRUE
      WHERE id = $1 AND user_id = $2 AND read = FALSE
    `;
    const result = await database.query(query, [id, userId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Marca todas as notificacoes de um usuario como lidas
   */
  async markAllAsRead(userId: string): Promise<number> {
    const query = `
      UPDATE notifications SET read = TRUE
      WHERE user_id = $1 AND read = FALSE
    `;
    const result = await database.query(query, [userId]);
    return result.rowCount || 0;
  }

  /**
   * Marca um lote de notificacoes como lidas
   */
  async markBatchAsRead(ids: string[], userId: string): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
    const query = `
      UPDATE notifications SET read = TRUE
      WHERE user_id = $1 AND id IN (${placeholders}) AND read = FALSE
    `;
    const result = await database.query(query, [userId, ...ids]);
    return result.rowCount || 0;
  }

  /**
   * Deleta uma notificacao
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = `DELETE FROM notifications WHERE id = $1 AND user_id = $2`;
    const result = await database.query(query, [id, userId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Busca IDs de todos os usuarios admin ativos
   */
  async findAdminUserIds(): Promise<string[]> {
    const query = `SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`;
    const result = await database.query<{ id: string }>(query);
    return result.rows.map(r => r.id);
  }

  /**
   * Busca IDs de todos os usuarios ativos
   */
  async findAllActiveUserIds(): Promise<string[]> {
    const query = `SELECT id FROM users WHERE status = 'ACTIVE'`;
    const result = await database.query<{ id: string }>(query);
    return result.rows.map(r => r.id);
  }
}

export default new NotificationRepository();
