import type { UserRole } from './roles';

export interface Permission {
  id: string;
  code: PermissionCode;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  created_at: Date;
}

export interface Role {
  id: string;
  code: UserRole | string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface CreateRoleDTO {
  code: string;
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface UpdateRoleDTO {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export type PermissionCode =
  | 'products:create' | 'products:read' | 'products:update' | 'products:delete'
  | 'kits:create' | 'kits:read' | 'kits:read:own' | 'kits:update' | 'kits:delete' | 'kits:assign'
  | 'users:read' | 'users:manage'
  | 'invites:create' | 'invites:read' | 'invites:delete'
  | 'notifications:broadcast'
  | 'reports:view'
  | 'profile:read' | 'profile:update';
