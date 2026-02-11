import { PoolClient } from 'pg';
import database from '../../../config/database';
import { NotFoundError, ConflictError } from '../../../utils/errors';
import type { QueryExecutor } from '../../../types/database';
import { buildPaginatedResponse, normalizePagination } from '../../../utils/pagination';
import {
  Product,
  CreateProductData,
  UpdateProductDTO,
  ProductListParams,
  PaginatedResponse,
} from '../../../types';

type ProductRow = Omit<Product, 'price'> & { price: string | number };

const normalizeProduct = (row: ProductRow): Product => ({
  ...row,
  price: typeof row.price === 'string' ? Number.parseFloat(row.price) : row.price,
});

class ProductRepository {
  /**
   * Cria um novo produto
   */
  async create(data: CreateProductData, client?: PoolClient): Promise<Product> {
    const executor: QueryExecutor = client || database;

    const result = await executor.query<ProductRow>(
      `INSERT INTO products (name, description, sku, price, stock)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.sku || null,
        data.price,
        data.stock,
      ]
    );

    return normalizeProduct(result.rows[0]);
  }

  /**
   * Busca produto por ID
   * @throws NotFoundError se nao encontrar
   */
  async findById(id: string): Promise<Product> {
    const result = await database.query<ProductRow>(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (!result.rows[0]) {
      throw new NotFoundError('Produto nao encontrado');
    }

    return normalizeProduct(result.rows[0]);
  }

  /**
   * Busca produto por ID (retorna null se nao encontrar)
   */
  async findByIdOrNull(id: string): Promise<Product | null> {
    const result = await database.query<ProductRow>(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
  }

  /**
   * Verifica se SKU ja existe
   */
  async skuExists(sku: string, excludeProductId?: string): Promise<boolean> {
    let query = 'SELECT 1 FROM products WHERE sku = $1';
    const params: string[] = [sku];

    if (excludeProductId) {
      query += ' AND id != $2';
      params.push(excludeProductId);
    }

    const result = await database.query(query, params);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Lista produtos com filtros e paginacao
   */
  async findAll(params: ProductListParams): Promise<PaginatedResponse<Product>> {
    const { active, minPrice, maxPrice, search, inStock } = params;
    const { page, limit, offset } = normalizePagination(params, { limit: 10 });
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Construir filtros dinamicamente
    if (active !== undefined) {
      conditions.push(`active = $${paramIndex++}`);
      values.push(active);
    }

    if (minPrice !== undefined) {
      conditions.push(`price >= $${paramIndex++}`);
      values.push(minPrice);
    }

    if (maxPrice !== undefined) {
      conditions.push(`price <= $${paramIndex++}`);
      values.push(maxPrice);
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (inStock === true) {
      conditions.push(`stock > 0`);
    } else if (inStock === false) {
      conditions.push(`stock = 0`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Query de contagem
    const countResult = await database.query<{ count: string }>(
      `SELECT COUNT(*) FROM products ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Query de dados
    const dataResult = await database.query<ProductRow>(
      `SELECT * FROM products
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset]
    );

    return buildPaginatedResponse(
      dataResult.rows.map(normalizeProduct),
      total,
      page,
      limit
    );
  }

  /**
   * Atualiza produto
   */
  async update(id: string, data: UpdateProductDTO, client?: PoolClient): Promise<Product> {
    const executor: QueryExecutor = client || database;

    // Construir SET dinamicamente (apenas campos fornecidos)
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description || null);
    }

    if (data.sku !== undefined) {
      updates.push(`sku = $${paramIndex++}`);
      values.push(data.sku || null);
    }

    if (data.price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(data.price);
    }

    if (data.stock !== undefined) {
      updates.push(`stock = $${paramIndex++}`);
      values.push(data.stock);
    }

    if (data.active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      values.push(data.active);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await executor.query<ProductRow>(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!result.rows[0]) {
      throw new NotFoundError('Produto nao encontrado');
    }

    return normalizeProduct(result.rows[0]);
  }

  /**
   * Atualiza estoque do produto
   */
  async updateStock(id: string, quantity: number, client?: PoolClient): Promise<Product> {
    const executor: QueryExecutor = client || database;

    const result = await executor.query<ProductRow>(
      `UPDATE products SET stock = $1 WHERE id = $2 RETURNING *`,
      [quantity, id]
    );

    if (!result.rows[0]) {
      throw new NotFoundError('Produto nao encontrado');
    }

    return normalizeProduct(result.rows[0]);
  }

  /**
   * Incrementa/decrementa estoque
   */
  async adjustStock(id: string, delta: number, client?: PoolClient): Promise<Product> {
    const executor: QueryExecutor = client || database;

    const result = await executor.query<ProductRow>(
      `UPDATE products SET stock = stock + $1 WHERE id = $2 AND stock + $1 >= 0 RETURNING *`,
      [delta, id]
    );

    if (!result.rows[0]) {
      const existsResult = await executor.query('SELECT 1 FROM products WHERE id = $1', [id]);
      if ((existsResult.rowCount || 0) > 0) {
        throw new ConflictError('Estoque insuficiente');
      }
      throw new NotFoundError('Produto nao encontrado');
    }

    return normalizeProduct(result.rows[0]);
  }

  /**
   * Remove produto (soft delete)
   */
  async delete(id: string): Promise<void> {
    const result = await database.query(
      'UPDATE products SET active = false WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Produto nao encontrado');
    }
  }

  /**
   * Remove produto permanentemente (hard delete)
   */
  async hardDelete(id: string): Promise<void> {
    const result = await database.query(
      'DELETE FROM products WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Produto nao encontrado');
    }
  }

  /**
   * Verifica se o produto possui itens vinculados em kits
   */
  async hasKitItems(id: string): Promise<boolean> {
    const result = await database.query(
      'SELECT 1 FROM kit_items WHERE product_id = $1 LIMIT 1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Estatisticas de produtos
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    outOfStock: number;
    lowStock: number;
  }> {
    const result = await database.query<{
      total: number;
      active: number;
      inactive: number;
      out_of_stock: number;
      low_stock: number;
    }>(
      `SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN active THEN 1 ELSE 0 END), 0)::int AS active,
        COALESCE(SUM(CASE WHEN NOT active THEN 1 ELSE 0 END), 0)::int AS inactive,
        COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0)::int AS out_of_stock,
        COALESCE(SUM(CASE WHEN stock > 0 AND stock <= 5 THEN 1 ELSE 0 END), 0)::int AS low_stock
      FROM products`
    );

    const row = result.rows[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      out_of_stock: 0,
      low_stock: 0,
    };

    return {
      total: Number(row.total || 0),
      active: Number(row.active || 0),
      inactive: Number(row.inactive || 0),
      outOfStock: Number(row.out_of_stock || 0),
      lowStock: Number(row.low_stock || 0),
    };
  }

  /**
   * Conta total de produtos
   */
  async count(activeOnly: boolean = false): Promise<number> {
    let query = 'SELECT COUNT(*) FROM products';
    if (activeOnly) {
      query += ' WHERE active = true';
    }

    const result = await database.query<{ count: string }>(query);
    return parseInt(result.rows[0].count, 10);
  }
}

export default new ProductRepository();
