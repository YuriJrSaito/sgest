import { FastifyInstance } from 'fastify';
import notificationController from './controllers/notificationController';
import { authenticate } from '../../middlewares/authMiddleware';
import { requirePermission } from '../../middlewares/permissionMiddleware';
import sseManager from './sse/sseManager';
import {
  listNotificationsSchema,
  unreadCountSchema,
  markReadSchema,
  markAllReadSchema,
  markBatchReadSchema,
  deleteNotificationSchema,
  broadcastSchema,
} from './schemas';

export default async function notificationRoutes(app: FastifyInstance) {
  // Inicializar SSE Manager
  sseManager.initialize();

  // ==========================================
  // ROTAS PROTEGIDAS (usuario autenticado)
  // ==========================================

  // GET /api/notifications - Listar notificacoes
  app.get('/', {
    preHandler: [authenticate],
    schema: listNotificationsSchema,
    handler: notificationController.list,
  });

  // GET /api/notifications/unread-count - Contagem de nao lidas
  app.get('/unread-count', {
    preHandler: [authenticate],
    schema: unreadCountSchema,
    handler: notificationController.unreadCount,
  });

  // GET /api/notifications/stream - Conexao SSE
  app.get('/stream', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const userId = request.user!.id;

      // Headers SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Evento de conexao
      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

      // Registrar conexao
      sseManager.addConnection(userId, reply);

      // Remover ao desconectar
      request.raw.on('close', () => {
        sseManager.removeConnection(userId, reply);
      });

      // Hijack para manter a conexao aberta
      reply.hijack();
    },
  });

  // PATCH /api/notifications/:id/read - Marcar como lida
  app.patch('/:id/read', {
    preHandler: [authenticate],
    schema: markReadSchema,
    handler: notificationController.markAsRead,
  });

  // PATCH /api/notifications/read-all - Marcar todas como lidas
  app.patch('/read-all', {
    preHandler: [authenticate],
    schema: markAllReadSchema,
    handler: notificationController.markAllAsRead,
  });

  // PATCH /api/notifications/read-batch - Marcar lote como lidas
  app.patch('/read-batch', {
    preHandler: [authenticate],
    schema: markBatchReadSchema,
    handler: notificationController.markBatchAsRead,
  });

  // DELETE /api/notifications/:id - Deletar notificacao
  app.delete('/:id', {
    preHandler: [authenticate],
    schema: deleteNotificationSchema,
    handler: notificationController.delete,
  });

  // ==========================================
  // ROTAS ADMIN
  // ==========================================

  // POST /api/notifications/broadcast - Enviar para todos
  app.post('/broadcast', {
    preHandler: [authenticate, requirePermission('notifications:broadcast')],
    schema: broadcastSchema,
    handler: notificationController.broadcast,
  });
}
