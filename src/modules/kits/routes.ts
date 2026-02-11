import { FastifyInstance } from 'fastify';
import kitController from './controllers/kitController';
import { authenticate } from '../../middlewares/authMiddleware';
import {
  requirePermission,
  requireAnyPermission,
} from '../../middlewares/permissionMiddleware';
import {
  createKitSchema,
  listKitsSchema,
  getKitSchema,
  updateKitSchema,
  deleteKitSchema,
  updateKitStatusSchema,
  assignKitSchema,
  unassignKitSchema,
  listKitItemsSchema,
  addKitItemSchema,
  updateKitItemSchema,
  removeKitItemSchema,
} from './schemas';

export default async function kitRoutes(app: FastifyInstance) {
  // POST /api/kits - Criar kit
  app.post('/', {
    preHandler: [authenticate, requirePermission('kits:create')],
    schema: createKitSchema,
    handler: kitController.create,
  });

  // GET /api/kits - Listar kits
  app.get('/', {
    preHandler: [authenticate, requireAnyPermission('kits:read', 'kits:read:own')],
    schema: listKitsSchema,
    handler: kitController.list,
  });

  // GET /api/kits/:id - Detalhes do kit
  app.get('/:id', {
    preHandler: [authenticate, requireAnyPermission('kits:read', 'kits:read:own')],
    schema: getKitSchema,
    handler: kitController.findById,
  });

  // PUT /api/kits/:id - Atualizar kit
  app.put('/:id', {
    preHandler: [authenticate, requirePermission('kits:update')],
    schema: updateKitSchema,
    handler: kitController.update,
  });

  // DELETE /api/kits/:id - Deletar kit (apenas draft)
  app.delete('/:id', {
    preHandler: [authenticate, requirePermission('kits:delete')],
    schema: deleteKitSchema,
    handler: kitController.delete,
  });

  // PATCH /api/kits/:id/status - Mudar status
  app.patch('/:id/status', {
    preHandler: [authenticate, requirePermission('kits:update')],
    schema: updateKitStatusSchema,
    handler: kitController.updateStatus,
  });

  // POST /api/kits/:id/assign - Atribuir revendedor
  app.post('/:id/assign', {
    preHandler: [authenticate, requirePermission('kits:assign')],
    schema: assignKitSchema,
    handler: kitController.assign,
  });

  // POST /api/kits/:id/unassign - Remover revendedor
  app.post('/:id/unassign', {
    preHandler: [authenticate, requirePermission('kits:assign')],
    schema: unassignKitSchema,
    handler: kitController.unassign,
  });

  // GET /api/kits/:id/items - Listar itens
  app.get('/:id/items', {
    preHandler: [authenticate, requireAnyPermission('kits:read', 'kits:read:own')],
    schema: listKitItemsSchema,
    handler: kitController.listItems,
  });

  // POST /api/kits/:id/items - Adicionar item
  app.post('/:id/items', {
    preHandler: [authenticate, requirePermission('kits:update')],
    schema: addKitItemSchema,
    handler: kitController.addItem,
  });
}

export async function kitItemRoutes(app: FastifyInstance) {
  // PUT /api/kit-items/:id - Atualizar quantidade
  app.put('/:id', {
    preHandler: [authenticate, requirePermission('kits:update')],
    schema: updateKitItemSchema,
    handler: kitController.updateItem,
  });

  // DELETE /api/kit-items/:id - Remover item
  app.delete('/:id', {
    preHandler: [authenticate, requirePermission('kits:update')],
    schema: removeKitItemSchema,
    handler: kitController.removeItem,
  });
}
