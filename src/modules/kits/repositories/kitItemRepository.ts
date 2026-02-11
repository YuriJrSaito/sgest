import { PoolClient } from 'pg';
import database from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import { KitItem, KitItemWithProduct } from '../../../types';
import type { QueryExecutor } from '../../../types/database';

class KitItemRepository {
  /**
   * Adiciona um item ao kit
   */
  async create(data: { kitId: string; productId: string; quantity: number; unitPrice: number }, client?: PoolClient): Promise<KitItem> {
    const executor: QueryExecutor = client || database;
    const query = `
      INSERT INTO kit_items (kit_id, product_id, quantity, unit_price)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [data.kitId, data.productId, data.quantity, data.unitPrice];
    const result = await executor.query<KitItem>(query, values);
    return result.rows[0];
  }

  /**
   * Busca item por ID
   */
  async findById(id: string): Promise<KitItem> {
    const query = `SELECT * FROM kit_items WHERE id = $1`;
    const result = await database.query<KitItem>(query, [id]);
    if (!result.rows[0]) {
      throw new NotFoundError('Item do kit nao encontrado');
    }
    return result.rows[0];
  }

  /**
   * Lista itens de um kit com dados do produto
   */
  async findByKitId(kitId: string): Promise<KitItemWithProduct[]> {
    const query = `
      SELECT ki.*,
        p.name as product_name,
        p.sku as product_sku
      FROM kit_items ki
      JOIN products p ON ki.product_id = p.id
      WHERE ki.kit_id = $1
      ORDER BY ki.created_at ASC
    `;
    const result = await database.query<KitItemWithProduct>(query, [kitId]);
    return result.rows;
  }

  /**
   * Busca item por kit e produto (para evitar duplicidade)
   */
  async findByKitIdAndProductId(
    kitId: string,
    productId: string,
    client?: PoolClient
  ): Promise<KitItem | null> {
    const executor: QueryExecutor = client || database;
    const result = await executor.query<KitItem>(
      `SELECT * FROM kit_items WHERE kit_id = $1 AND product_id = $2 LIMIT 1`,
      [kitId, productId]
    );
    return result.rows[0] || null;
  }

  /**
   * Lista todos os itens de um kit (sem join, para operacoes de estoque)
   */
  async findRawByKitId(kitId: string, client?: PoolClient): Promise<KitItem[]> {
    const executor: QueryExecutor = client || database;
    const query = `SELECT * FROM kit_items WHERE kit_id = $1`;
    const result = await executor.query<KitItem>(query, [kitId]);
    return result.rows;
  }

  /**
   * Atualiza quantidade de um item
   */
  async updateQuantity(id: string, quantity: number, client?: PoolClient): Promise<KitItem> {
    const executor: QueryExecutor = client || database;
    const query = `UPDATE kit_items SET quantity = $2 WHERE id = $1 RETURNING *`;
    const result = await executor.query<KitItem>(query, [id, quantity]);
    if (!result.rows[0]) {
      throw new NotFoundError('Item do kit nao encontrado');
    }
    return result.rows[0];
  }

  /**
   * Remove um item do kit
   */
  async delete(id: string, client?: PoolClient): Promise<boolean> {
    const executor: QueryExecutor = client || database;
    const query = `DELETE FROM kit_items WHERE id = $1`;
    const result = await executor.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Conta itens de um kit
   */
  async countByKitId(kitId: string, client?: PoolClient): Promise<number> {
    const executor: QueryExecutor = client || database;
    const query = `SELECT COUNT(*)::int as count FROM kit_items WHERE kit_id = $1`;
    const result = await executor.query<{ count: number }>(query, [kitId]);
    return result.rows[0].count;
  }
}

export default new KitItemRepository();
