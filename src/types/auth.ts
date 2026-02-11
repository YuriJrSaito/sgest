import type { PermissionCode } from './permissions';
import type { UserRole } from './roles';
import type { User } from './users';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  permissions?: string[];
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface ChangePasswordRequestDTO {
  currentPassword: string;
  newPassword: string;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: UserRole;
  permissions?: PermissionCode[];
  jti: string;  // JWT ID para rastreamento e revogacao
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: Omit<User, 'password_hash'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  jti: string;
  family_id: string;
  expires_at: Date;
  revoked: boolean;
  revoked_at?: Date;
  replaced_by_jti?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user?: Omit<User, 'password_hash'>;
}

export interface TokenBlacklist {
  id: string;
  jti: string;
  user_id: string;
  token_hash: string;
  reason: string;
  expires_at: Date;
  created_at: Date;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used: boolean;
  used_at?: Date;
  ip_address?: string;
  created_at: Date;
}

export interface RequestPasswordResetDTO {
  email: string;
}

export interface ResetPasswordDTO {
  token: string;
  newPassword: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  success: boolean;
  user_agent?: string;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  status: 'success' | 'failure' | 'blocked';
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}
