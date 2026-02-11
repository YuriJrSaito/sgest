import type { PaginationParams } from './pagination';

export type NotificationType = 'system' | 'invite' | 'product' | 'reseller';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: Date;
}

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface NotificationListParams extends PaginationParams {
  read?: boolean;
  type?: NotificationType;
}

export interface BroadcastNotificationDTO {
  title: string;
  message: string;
}

export interface MarkBatchReadDTO {
  ids: string[];
}
