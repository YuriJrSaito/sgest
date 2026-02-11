import { FastifyRequest, FastifyReply } from 'fastify';
import notificationService from '../services/notificationService';
import {
  NotificationListParams,
  MarkBatchReadDTO,
  BroadcastNotificationDTO,
} from '../../../types';

interface IdParam {
  id: string;
}

class NotificationController {
  /**
   * GET /api/notifications
   * Lista notificacoes do usuario autenticado
   */
  async list(
    request: FastifyRequest<{ Querystring: NotificationListParams }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.id;
    const result = await notificationService.list(userId, request.query);

    return reply.send({
      status: 'success',
      data: {
        notifications: result.data.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          read: n.read,
          createdAt: n.created_at,
        })),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  /**
   * GET /api/notifications/unread-count
   * Retorna contagem de notificacoes nao lidas
   */
  async unreadCount(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = request.user!.id;
    const count = await notificationService.getUnreadCount(userId);

    return reply.send({
      status: 'success',
      data: { count },
    });
  }

  /**
   * PATCH /api/notifications/:id/read
   * Marca uma notificacao como lida
   */
  async markAsRead(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.id;
    await notificationService.markAsRead(request.params.id, userId);

    return reply.send({
      status: 'success',
      message: 'Notificacao marcada como lida',
    });
  }

  /**
   * PATCH /api/notifications/read-all
   * Marca todas as notificacoes como lidas
   */
  async markAllAsRead(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = request.user!.id;
    const count = await notificationService.markAllAsRead(userId);

    return reply.send({
      status: 'success',
      message: 'Todas as notificacoes marcadas como lidas',
      data: { count },
    });
  }

  /**
   * PATCH /api/notifications/read-batch
   * Marca um lote de notificacoes como lidas
   */
  async markBatchAsRead(
    request: FastifyRequest<{ Body: MarkBatchReadDTO }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.id;
    const count = await notificationService.markBatchAsRead(request.body.ids, userId);

    return reply.send({
      status: 'success',
      message: `${count} notificacoes marcadas como lidas`,
      data: { count },
    });
  }

  /**
   * DELETE /api/notifications/:id
   * Deleta uma notificacao
   */
  async delete(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.id;
    await notificationService.delete(request.params.id, userId);

    return reply.send({
      status: 'success',
      message: 'Notificacao removida',
    });
  }

  /**
   * POST /api/notifications/broadcast
   * Envia notificacao para todos os usuarios (admin only)
   */
  async broadcast(
    request: FastifyRequest<{ Body: BroadcastNotificationDTO }>,
    reply: FastifyReply
  ) {
    const { title, message } = request.body;
    const count = await notificationService.notifyAll({
      type: 'system',
      title,
      message,
    });

    return reply.status(201).send({
      status: 'success',
      message: `Notificacao enviada para ${count} usuarios`,
      data: { count },
    });
  }
}

export default new NotificationController();
