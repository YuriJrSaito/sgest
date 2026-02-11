export interface ResellerProfile {
  id: string;
  user_id: string;
  commission_rate: number;
  pix_key?: string;
  max_discount_allowed: number;
  credit_limit: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateResellerProfileData {
  userId: string;
  commissionRate?: number | null;
  pixKey?: string;
  maxDiscountAllowed?: number;
  creditLimit?: number;
}

export interface UpdateResellerProfileDTO {
  commissionRate?: number;
  pixKey?: string;
  maxDiscountAllowed?: number;
  creditLimit?: number;
}
