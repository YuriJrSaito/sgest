import type { PaginationParams } from './pagination';

export type KitStatus = 'draft' | 'assembling' | 'delivered' | 'returned';

export interface Kit {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: KitStatus;
  reseller_id: string | null;
  assigned_at: Date | null;
  returned_at: Date | null;
  notes: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface KitWithDetails extends Kit {
  reseller_name?: string;
  item_count: number;
  total_value: number;
}

export interface KitItem {
  id: string;
  kit_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: Date;
}

export interface KitItemWithProduct extends KitItem {
  product_name: string;
  product_sku: string | null;
}

export interface CreateKitDTO {
  name: string;
  description?: string;
}

export interface UpdateKitDTO {
  name?: string;
  description?: string;
  notes?: string;
}

export interface AddKitItemDTO {
  productId: string;
  quantity: number;
}

export interface UpdateKitItemDTO {
  quantity: number;
}

export interface AssignKitDTO {
  resellerId: string;
}

export interface KitListParams extends PaginationParams {
  status?: KitStatus;
  resellerId?: string;
  search?: string;
}
