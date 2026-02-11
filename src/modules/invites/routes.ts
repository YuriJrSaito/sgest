import { FastifyInstance } from 'fastify';
import inviteController from './controllers/inviteController';
import { authenticate } from '../../middlewares/authMiddleware';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import {
  createInviteSchema,
  listInvitesSchema,
  validateTokenSchema,
  acceptInviteSchema,
  getInviteSchema,
  revokeInviteSchema,
  resendInviteSchema,
} from './schemas';

export default async function inviteRoutes(app: FastifyInstance) {
  // ==========================================
  // ROTAS PUBLICAS (sem autenticacao)
  // ==========================================

  // GET /api/invites/validate/:token - Validar token de convite
  app.get('/validate/:token', {
    schema: validateTokenSchema,
    handler: inviteController.validateToken,
  });

  // POST /api/invites/accept - Aceitar convite e criar conta
  app.post('/accept', {
    schema: acceptInviteSchema,
    handler: inviteController.accept,
  });

  // ==========================================
  // ROTAS PROTEGIDAS (apenas admin)
  // ==========================================

  // POST /api/invites - Criar convite
  app.post('/', {
    preHandler: [authenticate, requirePermission('invites:create')],
    schema: createInviteSchema,
    handler: inviteController.create,
  });

  // GET /api/invites - Listar convites
  app.get('/', {
    preHandler: [authenticate, requirePermission('invites:read')],
    schema: listInvitesSchema,
    handler: inviteController.list,
  });

  // GET /api/invites/:id - Buscar convite por ID
  app.get('/:id', {
    preHandler: [authenticate, requirePermission('invites:read')],
    schema: getInviteSchema,
    handler: inviteController.findById,
  });

  // DELETE /api/invites/:id - Revogar convite
  app.delete('/:id', {
    preHandler: [authenticate, requirePermission('invites:delete')],
    schema: revokeInviteSchema,
    handler: inviteController.revoke,
  });

  // POST /api/invites/:id/resend - Reenviar convite
  app.post('/:id/resend', {
    preHandler: [authenticate, requirePermission('invites:create')],
    schema: resendInviteSchema,
    handler: inviteController.resend,
  });
}
