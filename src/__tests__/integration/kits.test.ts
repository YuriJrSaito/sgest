// src/__tests__/integration/kits.test.ts
import Fastify from 'fastify';
import kitRoutes, { kitItemRoutes } from '../../modules/kits/routes';
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

describe('Kits Integration Tests', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(kitRoutes, { prefix: '/api/kits' });
    await app.register(kitItemRoutes, { prefix: '/api/kit-items' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('deve criar kit como admin', async () => {
    const admin = await createAdminUser();
    const token = generateToken(admin.id, admin.email, admin.role);

    const response = await app.inject({
      method: 'POST',
      url: '/api/kits',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'Kit Primavera',
        description: 'Colecao 2025',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('success');
    expect(body.data.kit.name).toBe('Kit Primavera');
    expect(body.data.kit.status).toBe('draft');
    expect(body.data.kit.code).toBe('KIT-001');
  });

  it('deve listar apenas kits atribuidos para reseller', async () => {
    const admin = await createAdminUser();
    const reseller = await createTestUser({ email: 'reseller@test.com' });
    const adminToken = generateToken(admin.id, admin.email, admin.role);
    const resellerToken = generateToken(reseller.id, reseller.email, reseller.role);

    const kit1Response = await app.inject({
      method: 'POST',
      url: '/api/kits',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Kit A' },
    });

    const kit1 = kit1Response.json().data.kit;

    await app.inject({
      method: 'POST',
      url: `/api/kits/${kit1.id}/assign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { resellerId: reseller.id },
    });

    await app.inject({
      method: 'POST',
      url: '/api/kits',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Kit B' },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/kits',
      headers: { authorization: `Bearer ${resellerToken}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json();
    expect(listBody.data.kits).toHaveLength(1);
    expect(listBody.data.kits[0].id).toBe(kit1.id);
  });

  it('deve adicionar, atualizar e remover item do kit', async () => {
    const admin = await createAdminUser();
    const token = generateToken(admin.id, admin.email, admin.role);
    const product = await createProduct({ stock: 10, sku: 'SKU-ITEM-1' });

    const kitResponse = await app.inject({
      method: 'POST',
      url: '/api/kits',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Kit Itens' },
    });

    const kit = kitResponse.json().data.kit;

    const addResponse = await app.inject({
      method: 'POST',
      url: `/api/kits/${kit.id}/items`,
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: product.id, quantity: 2 },
    });

    expect(addResponse.statusCode).toBe(201);
    const item = addResponse.json().data.item;

    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/kit-items/${item.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { quantity: 3 },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data.item.quantity).toBe(3);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/kit-items/${item.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(deleteResponse.statusCode).toBe(200);

    const itemsResponse = await app.inject({
      method: 'GET',
      url: `/api/kits/${kit.id}/items`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(itemsResponse.statusCode).toBe(200);
    expect(itemsResponse.json().data.items).toHaveLength(0);
  });

  it('deve reduzir estoque ao iniciar montagem e bloquear entrega sem revendedor', async () => {
    const admin = await createAdminUser();
    const token = generateToken(admin.id, admin.email, admin.role);
    const product = await createProduct({ stock: 5, sku: 'SKU-STOCK-1' });

    const kitResponse = await app.inject({
      method: 'POST',
      url: '/api/kits',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Kit Status' },
    });

    const kit = kitResponse.json().data.kit;

    await app.inject({
      method: 'POST',
      url: `/api/kits/${kit.id}/items`,
      headers: { authorization: `Bearer ${token}` },
      payload: { productId: product.id, quantity: 2 },
    });

    const assembleResponse = await app.inject({
      method: 'PATCH',
      url: `/api/kits/${kit.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'assembling' },
    });

    expect(assembleResponse.statusCode).toBe(200);

    const stockResult = await database.query('SELECT stock FROM products WHERE id = $1', [product.id]);
    expect(stockResult.rows[0].stock).toBe(3);

    const deliverResponse = await app.inject({
      method: 'PATCH',
      url: `/api/kits/${kit.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'delivered' },
    });

    expect(deliverResponse.statusCode).toBe(422);
  });
});
