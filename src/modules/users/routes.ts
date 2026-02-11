import { FastifyInstance } from 'fastify';
import userController from './controllers/userController';
import { authenticate } from '../../middlewares/authMiddleware';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import { listUsersSchema } from './schemas';

export default async function userRoutes(app: FastifyInstance) {
  app.get('/', {
    preHandler: [authenticate, requirePermission('users:read')],
    schema: listUsersSchema,
    handler: userController.list,
  });
}
