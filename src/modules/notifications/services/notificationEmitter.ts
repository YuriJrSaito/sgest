import redis from '../../../config/redis';
import { Notification } from '../../../types';

const CHANNEL = 'notifications:new';

/**
 * Emite uma notificacao via Redis Pub/Sub para ser entregue via SSE
 */
export async function emitNotification(userId: string, notification: Notification): Promise<void> {
  const payload = JSON.stringify({ userId, notification });
  await redis.publish(CHANNEL, payload);
}

/**
 * Emite notificacoes para multiplos usuarios
 */
export async function emitNotificationToMany(userIds: string[], notification: Omit<Notification, 'user_id'>): Promise<void> {
  const pipeline = redis.pipeline();
  for (const userId of userIds) {
    const payload = JSON.stringify({ userId, notification: { ...notification, user_id: userId } });
    pipeline.publish(CHANNEL, payload);
  }
  await pipeline.exec();
}

/**
 * Emite notificacoes com IDs reais (uma por usuario)
 */
export async function emitNotificationBatch(notifications: Notification[]): Promise<void> {
  if (notifications.length === 0) return;
  const pipeline = redis.pipeline();
  for (const notification of notifications) {
    const payload = JSON.stringify({ userId: notification.user_id, notification });
    pipeline.publish(CHANNEL, payload);
  }
  await pipeline.exec();
}

export const NOTIFICATION_CHANNEL = CHANNEL;
