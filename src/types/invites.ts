import type { PaginationParams } from './pagination';
import type { UserRole } from './roles';
import type { User } from './users';

export interface Invite {
  id: string;
  email: string;
  token: string;
  role_to_assign: UserRole;
  commission_rate?: number | null;
  expires_at: Date;
  used_at?: Date;
  created_by: string;
  created_at: Date;
}

export interface InviteWithCreator extends Invite {
  creator: Pick<User, 'id' | 'name' | 'email'>;
}

export interface CreateInviteDTO {
  email: string;
  roleToAssign: UserRole;
  commissionRate?: number;  // Para revendedores
}

export interface CreateInviteData {
  email: string;
  token: string;
  roleToAssign: UserRole;
  commissionRate?: number | null;
  expiresAt: Date;
  createdBy: string;
}

export interface AcceptInviteDTO {
  token: string;
  name: string;
  password: string;
}

export interface InviteListParams extends PaginationParams {
  status?: 'pending' | 'used' | 'expired';
  email?: string;
}
