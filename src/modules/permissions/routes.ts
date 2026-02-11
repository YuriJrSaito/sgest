import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/authMiddleware';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import permissionController from './controllers/permissionController';
import {
  listPermissionsSchema,
  listRolesSchema,
  updateRolePermissionsSchema,
} from './schemas';

export default async function permissionRoutes(app: FastifyInstance) {
  app.get('/', {
    preHandler: [authenticate, requirePermission('users:manage')],
    schema: listPermissionsSchema,
    handler: permissionController.listPermissions,
  });

  app.get('/roles', {
    preHandler: [authenticate, requirePermission('users:manage')],
    schema: listRolesSchema,
    handler: permissionController.listRoles,
  });

  app.put('/roles/:roleCode', {
    preHandler: [authenticate, requirePermission('users:manage')],
    schema: updateRolePermissionsSchema,
    handler: permissionController.updateRolePermissions,
  });
}
