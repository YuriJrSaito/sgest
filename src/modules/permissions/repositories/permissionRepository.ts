import { PoolClient } from 'pg';
import database from '../../../config/database';
import {
  Permission,
  PermissionCode,
  RoleWithPermissions,
  Role,
} from '../../../types';
import { NotFoundError, ValidationError } from '../../../utils/errors';

type PermissionRow = Omit<Permission, 'code'> & { code: string };
type RoleRow = Role;

const FALLBACK_PERMISSION_DEFS: Array<{
  code: PermissionCode;
  name: string;
  description: string;
  resource: string;
  action: string;
}> = [
  { code: 'products:create', name: 'Criar produtos', description: 'Permite criar novos produtos', resource: 'products', action: 'create' },
  { code: 'products:read', name: 'Visualizar produtos', description: 'Permite visualizar produtos', resource: 'products', action: 'read' },
  { code: 'products:update', name: 'Editar produtos', description: 'Permite editar produtos', resource: 'products', action: 'update' },
  { code: 'products:delete', name: 'Excluir produtos', description: 'Permite excluir produtos', resource: 'products', action: 'delete' },
  { code: 'kits:create', name: 'Criar kits', description: 'Permite criar novos kits', resource: 'kits', action: 'create' },
  { code: 'kits:read', name: 'Visualizar kits', description: 'Permite visualizar kits', resource: 'kits', action: 'read' },
  { code: 'kits:read:own', name: 'Visualizar proprios kits', description: 'Permite visualizar apenas kits atribuidos ao usuario', resource: 'kits', action: 'read:own' },
  { code: 'kits:update', name: 'Editar kits', description: 'Permite editar kits', resource: 'kits', action: 'update' },
  { code: 'kits:delete', name: 'Excluir kits', description: 'Permite excluir kits', resource: 'kits', action: 'delete' },
  { code: 'kits:assign', name: 'Atribuir kits', description: 'Permite atribuir kits para revendedoras', resource: 'kits', action: 'assign' },
  { code: 'users:read', name: 'Visualizar usuarios', description: 'Permite visualizar usuarios', resource: 'users', action: 'read' },
  { code: 'users:manage', name: 'Gerenciar usuarios', description: 'Permite gerenciar usuarios', resource: 'users', action: 'manage' },
  { code: 'invites:create', name: 'Criar convites', description: 'Permite criar convites', resource: 'invites', action: 'create' },
  { code: 'invites:read', name: 'Visualizar convites', description: 'Permite visualizar convites', resource: 'invites', action: 'read' },
  { code: 'invites:delete', name: 'Excluir convites', description: 'Permite excluir convites', resource: 'invites', action: 'delete' },
  { code: 'notifications:broadcast', name: 'Broadcast de notificacoes', description: 'Permite enviar notificacoes em massa', resource: 'notifications', action: 'broadcast' },
  { code: 'reports:view', name: 'Visualizar relatorios', description: 'Permite visualizar relatorios e metricas', resource: 'reports', action: 'view' },
  { code: 'profile:read', name: 'Visualizar perfil', description: 'Permite visualizar o proprio perfil', resource: 'profile', action: 'read' },
  { code: 'profile:update', name: 'Editar perfil', description: 'Permite editar o proprio perfil', resource: 'profile', action: 'update' },
];

const FALLBACK_ROLE_CODES: Record<string, PermissionCode[]> = {
  ADMIN: FALLBACK_PERMISSION_DEFS.map((item) => item.code),
  GERENTE: [
    'products:read',
    'kits:read',
    'kits:assign',
    'users:read',
    'reports:view',
    'profile:read',
    'profile:update',
  ],
  RESELLER: [
    'kits:read:own',
    'profile:read',
    'profile:update',
  ],
};

const FALLBACK_ROLES: Role[] = [
  {
    id: 'fallback-admin',
    code: 'ADMIN',
    name: 'Administrador',
    description: 'Acesso total do sistema',
    is_system: true,
    created_at: new Date(0),
    updated_at: new Date(0),
  },
  {
    id: 'fallback-manager',
    code: 'GERENTE',
    name: 'Gerente',
    description: 'Gerencia produtos e usuarios',
    is_system: false,
    created_at: new Date(0),
    updated_at: new Date(0),
  },
  {
    id: 'fallback-reseller',
    code: 'RESELLER',
    name: 'Revendedora',
    description: 'Acesso limitado aos proprios recursos',
    is_system: true,
    created_at: new Date(0),
    updated_at: new Date(0),
  },
];

function toPermission(def: typeof FALLBACK_PERMISSION_DEFS[number]): Permission {
  return {
    id: `fallback-${def.code}`,
    code: def.code,
    name: def.name,
    description: def.description,
    resource: def.resource,
    action: def.action,
    created_at: new Date(0),
  };
}

function isTableMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === '42P01';
}

export class PermissionRepository {
  private mapPermissionRow(row: PermissionRow): Permission {
    return {
      ...row,
      code: row.code as PermissionCode,
    };
  }

  private getFallbackPermissionsByRole(roleCode: string): Permission[] {
    const allowedCodes = FALLBACK_ROLE_CODES[roleCode] || [];
    const allowedSet = new Set(allowedCodes);
    return FALLBACK_PERMISSION_DEFS
      .filter((def) => allowedSet.has(def.code))
      .map(toPermission);
  }

  async listAll(): Promise<Permission[]> {
    try {
      const result = await database.query<PermissionRow>(
        `SELECT id, code, name, description, resource, action, created_at
         FROM permissions
         ORDER BY resource ASC, action ASC`
      );
      if (!result || !Array.isArray(result.rows)) {
        return FALLBACK_PERMISSION_DEFS.map(toPermission);
      }
      return result.rows.map((row) => this.mapPermissionRow(row));
    } catch (error) {
      if (!isTableMissing(error)) {
        throw error;
      }
      return FALLBACK_PERMISSION_DEFS.map(toPermission);
    }
  }

  async findByRoleCode(roleCode: string): Promise<Permission[]> {
    try {
      const result = await database.query<PermissionRow>(
        `SELECT p.id, p.code, p.name, p.description, p.resource, p.action, p.created_at
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         JOIN roles r ON r.id = rp.role_id
         WHERE r.code = $1
         ORDER BY p.resource ASC, p.action ASC`,
        [roleCode]
      );
      if (!result || !Array.isArray(result.rows)) {
        return this.getFallbackPermissionsByRole(roleCode);
      }
      return result.rows.map((row) => this.mapPermissionRow(row));
    } catch (error) {
      if (!isTableMissing(error)) {
        throw error;
      }
      return this.getFallbackPermissionsByRole(roleCode);
    }
  }

  async findCodesByRoleCode(roleCode: string): Promise<PermissionCode[]> {
    const permissions = await this.findByRoleCode(roleCode);
    return permissions.map((permission) => permission.code);
  }

  private async findRoleWithPermissions(
    roleCode: string,
    client?: PoolClient
  ): Promise<RoleWithPermissions> {
    const roleResult = client
      ? await client.query<RoleRow>(
          `SELECT id, code, name, description, is_system, created_at, updated_at
           FROM roles
           WHERE code = $1`,
          [roleCode]
        )
      : await database.query<RoleRow>(
          `SELECT id, code, name, description, is_system, created_at, updated_at
           FROM roles
           WHERE code = $1`,
          [roleCode]
        );

    const role = roleResult.rows[0];
    if (!role) {
      throw new NotFoundError('Papel nao encontrado');
    }

    const permissionResult = client
      ? await client.query<PermissionRow>(
          `SELECT p.id, p.code, p.name, p.description, p.resource, p.action, p.created_at
           FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           WHERE rp.role_id = $1
           ORDER BY p.resource ASC, p.action ASC`,
          [role.id]
        )
      : await database.query<PermissionRow>(
          `SELECT p.id, p.code, p.name, p.description, p.resource, p.action, p.created_at
           FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id
           WHERE rp.role_id = $1
           ORDER BY p.resource ASC, p.action ASC`,
          [role.id]
        );

    return {
      ...role,
      permissions: permissionResult.rows.map((row: PermissionRow) => this.mapPermissionRow(row)),
    };
  }

  async listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    try {
      const roleRows = await database.query<RoleRow>(
        `SELECT id, code, name, description, is_system, created_at, updated_at
         FROM roles
         ORDER BY code ASC`
      );
      if (!roleRows || !Array.isArray(roleRows.rows)) {
        return FALLBACK_ROLES.map((role) => ({
          ...role,
          permissions: this.getFallbackPermissionsByRole(role.code),
        }));
      }

      const roles = roleRows.rows;
      const result: RoleWithPermissions[] = [];
      for (const role of roles) {
        const withPermissions = await this.findRoleWithPermissions(role.code);
        result.push(withPermissions);
      }

      return result;
    } catch (error) {
      if (!isTableMissing(error)) {
        throw error;
      }

      return FALLBACK_ROLES.map((role) => ({
        ...role,
        permissions: this.getFallbackPermissionsByRole(role.code),
      }));
    }
  }

  async updateRolePermissions(roleCode: string, permissionIds: string[]): Promise<RoleWithPermissions> {
    return database.transaction(async (client) => {
      const roleResult = await client.query<{ id: string; code: string }>(
        `SELECT id, code
         FROM roles
         WHERE code = $1
         FOR UPDATE`,
        [roleCode]
      );

      const role = roleResult.rows[0];
      if (!role) {
        throw new NotFoundError('Papel nao encontrado');
      }

      if (permissionIds.length > 0) {
        const permissionResult = await client.query<{ id: string }>(
          `SELECT id
           FROM permissions
           WHERE id = ANY($1::uuid[])`,
          [permissionIds]
        );

        if (permissionResult.rowCount !== permissionIds.length) {
          throw new ValidationError('Uma ou mais permissoes informadas sao invalidas');
        }
      }

      await client.query(
        `DELETE FROM role_permissions
         WHERE role_id = $1`,
        [role.id]
      );

      if (permissionIds.length > 0) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, unnest($2::uuid[])
           ON CONFLICT DO NOTHING`,
          [role.id, permissionIds]
        );
      }

      return this.findRoleWithPermissions(roleCode, client);
    });
  }
}

const permissionRepository = new PermissionRepository();

export default permissionRepository;
