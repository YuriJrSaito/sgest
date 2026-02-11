import type { PermissionCode } from './permissions';
import type { PaginationParams } from './pagination';
import type { UserRole } from './roles';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  role: UserRole;
  status: UserStatus;
  permissions?: PermissionCode[];
  failed_login_attempts?: number;
  last_failed_login_at?: Date | null;
  locked_until?: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Objeto interno para criacao de usuario (usado pelo repository)
export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UserListParams extends PaginationParams {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}
