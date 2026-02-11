import { FastifyInstance } from 'fastify';
import productController from './controllers/productController';
import { authenticate } from '../../middlewares/authMiddleware';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import {
  createProductSchema,
  getProductSchema,
  listProductsSchema,
  productStatsSchema,
  updateProductSchema,
  updateStockSchema,
  adjustStockSchema,
  deleteProductSchema,
  hardDeleteProductSchema,
} from './schemas';

export default async function productRoutes(app: FastifyInstance) {
  // Todas as rotas de produtos requerem autenticacao
  // Apenas administradores podem acessar

  // POST /api/products - Criar produto (apenas admin)
  app.post('/', {
    preHandler: [authenticate, requirePermission('products:create')],
    schema: createProductSchema,
    handler: productController.create,
  });

  // GET /api/products - Listar produtos
  // Apenas admin
  app.get('/', {
    preHandler: [authenticate, requirePermission('products:read')],
    schema: listProductsSchema,
    handler: productController.findAll,
  });

  // GET /api/products/stats - Estatisticas (admin)
  app.get('/stats', {
    preHandler: [authenticate, requirePermission('products:read')],
    schema: productStatsSchema,
    handler: productController.getStats,
  });

  // GET /api/products/:id - Buscar produto por ID
  app.get('/:id', {
    preHandler: [authenticate, requirePermission('products:read')],
    schema: getProductSchema,
    handler: productController.findById,
  });

  // PUT /api/products/:id - Atualizar produto
  app.put('/:id', {
    preHandler: [authenticate, requirePermission('products:update')],
    schema: updateProductSchema,
    handler: productController.update,
  });

  // PATCH /api/products/:id/stock - Atualizar estoque (valor absoluto)
  app.patch('/:id/stock', {
    preHandler: [authenticate, requirePermission('products:update')],
    schema: updateStockSchema,
    handler: productController.updateStock,
  });

  // PATCH /api/products/:id/stock/adjust - Ajustar estoque (delta)
  app.patch('/:id/stock/adjust', {
    preHandler: [authenticate, requirePermission('products:update')],
    schema: adjustStockSchema,
    handler: productController.adjustStock,
  });

  // DELETE /api/products/:id - Remover produto (soft delete)
  app.delete('/:id', {
    preHandler: [authenticate, requirePermission('products:delete')],
    schema: deleteProductSchema,
    handler: productController.delete,
  });

  // DELETE /api/products/:id/permanent - Remover permanentemente (apenas admin)
  app.delete('/:id/permanent', {
    preHandler: [authenticate, requirePermission('products:delete')],
    schema: hardDeleteProductSchema,
    handler: productController.hardDelete,
  });
}
