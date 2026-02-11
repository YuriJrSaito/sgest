import notificationRepository from '../repositories/notificationRepository';
import { emitNotification, emitNotificationBatch } from './notificationEmitter';
import {
  Notification,
  CreateNotificationData,
  NotificationListParams,
  PaginatedResponse,
  NotificationType,
} from '../../../types';
import { NotFoundError } from '../../../utils/errors';

interface NotifyData {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

class NotificationService {
  /**
   * Lista notificacoes de um usuario com paginacao e filtros
   */
  async list(userId: string, params: NotificationListParams = {}): Promise<PaginatedResponse<Notification>> {
    return notificationRepository.findByUserId(userId, params);
  }

  /**
   * Retorna a contagem de notificacoes nao lidas
   */
  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId);
  }

  /**
   * Marca uma notificacao como lida
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    const updated = await notificationRepository.markAsRead(id, userId);
    if (!updated) {
      throw new NotFoundError('Notificacao nao encontrada ou ja lida');
    }
  }

  /**
   * Marca todas as notificacoes do usuario como lidas
   */
  async markAllAsRead(userId: string): Promise<number> {
    return notificationRepository.markAllAsRead(userId);
  }

  /**
   * Marca um lote de notificacoes como lidas
   */
  async markBatchAsRead(ids: string[], userId: string): Promise<number> {
    return notificationRepository.markBatchAsRead(ids, userId);
  }

  /**
   * Deleta uma notificacao
   */
  async delete(id: string, userId: string): Promise<void> {
    const deleted = await notificationRepository.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError('Notificacao nao encontrada');
    }
  }

  /**
   * Cria e emite uma notificacao para um usuario especifico
   */
  async notifyUser(userId: string, data: NotifyData): Promise<Notification> {
    const notificationData: CreateNotificationData = {
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
    };

    const notification = await notificationRepository.create(notificationData);

    // Emitir via SSE
    await emitNotification(userId, notification);

    return notification;
  }

  /**
   * Cria e emite notificacoes para todos os admins
   */
  async notifyAdmins(data: NotifyData): Promise<void> {
    const adminIds = await notificationRepository.findAdminUserIds();

    if (adminIds.length === 0) return;

    // Criar notificacoes em lote
    const notifications: CreateNotificationData[] = adminIds.map(userId => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
    }));

    const created = await notificationRepository.createBatch(notifications);

    // Emitir via SSE para todos os admins com IDs reais
    await emitNotificationBatch(created);
  }

  /**
   * Cria e emite notificacoes para todos os usuarios ativos (broadcast)
   */
  async notifyAll(data: NotifyData): Promise<number> {
    const userIds = await notificationRepository.findAllActiveUserIds();

    if (userIds.length === 0) return 0;

    // Criar notificacoes em lote
    const notifications: CreateNotificationData[] = userIds.map(userId => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
    }));

    const created = await notificationRepository.createBatch(notifications);

    // Emitir via SSE para todos com IDs reais
    await emitNotificationBatch(created);

    return created.length;
  }
}

export default new NotificationService();
