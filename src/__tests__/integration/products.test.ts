// src/__tests__/integration/products.test.ts
import Fastify from 'fastify';
import productRoutes from '../../modules/product/routes';
import { errorHandler } from '../../utils/errors';
import {
  cleanDatabase,
  createAdminUser,
  createTestUser,
  generateToken,
} from '../helpers/testHelpers';
import database from '../../config/database';

async function createProduct(data?: { name?: string; sku?: string; price?: number; stock?: number }) {
  const result = await database.query(
    `INSERT INTO products (name, description, sku, price, stock)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data?.name || 'Produto Teste',
      'Descricao',
      data?.sku || `SKU-${Date.now()}`,
      data?.price ?? 100,
      data?.stock ?? 10,
    ]
  );

  return result.rows[0];
}

async function createKit(createdBy: string, data?: { code?: string; name?: string }) {
  const result = await database.query(
    `INSERT INTO kits (code, name, description, status, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data?.code || 'KIT-001',
      data?.name || 'Kit Teste',
      null,
      'draft',
      createdBy,
    ]
  );

  return result.rows[0];
}

async function createKitItem(data: { kitId: string; productId: string; quantity?: number; unitPrice?: number }) {
  const result = await database.query(
    `INSERT INTO kit_items (kit_id, product_id, quantity, unit_price)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.kitId,
      data.productId,
      data.quantity ?? 1,
      data.unitPrice ?? 10,
    ]
  );

  return result.rows[0];
}

describe('Products Integration Tests', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(productRoutes, { prefix: '/api/products' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('deve criar produto como admin', async () => {
    const admin = await createAdminUser();
    const token = generateToken(admin.id, admin.email, admin.role);

    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'Produto A',
        price: 120,
        stock: 5,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('success');
    expect(body.data.product.name).toBe('Produto A');
  });

  it('deve negar listagem para reseller', async () => {
    const reseller = await createTestUser({ email: 'reseller@test.com' });
    const token = generateToken(reseller.id, reseller.email, reseller.role);

    const response = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('deve impedir ajuste de estoque abaixo de zero', async () => {
    const admin = await createAdminUser();
    const token = generateToken(admin.id, admin.email, admin.role);
    const product = await createProduct({ stock: 1, sku: 'SKU-ADJ-1' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/products/${product.id}/stock/adjust`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        delta: -2,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe('Estoque insuficiente');
  });

  it('deve bloquear hard delete quando produto esta em kits', async () => {
    const admin = await createAdminUser();
    const token = generateToken(admin.id, admin.email, admin.role);
    const product = await createProduct({ stock: 5, sku: 'SKU-KIT-1' });
    const kit = await createKit(admin.id);

    await createKitItem({ kitId: kit.id, productId: product.id, quantity: 1, unitPrice: 10 });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/products/${product.id}/permanent`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe('Produto possui itens em kits e nao pode ser removido permanentemente');

    const exists = await database.query('SELECT 1 FROM products WHERE id = $1', [product.id]);
    expect(exists.rowCount).toBe(1);
  });
});
