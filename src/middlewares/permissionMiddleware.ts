import { FastifyRequest } from 'fastify';
import permissionRepository from '../modules/permissions/repositories/permissionRepository';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

// Cache simples por role para evitar query repetida por request.
const permissionCache = new Map<string, Set<string>>();

function withAdminWildcard(roleCode: string, permissions: Set<string>): Set<string> {
  if (roleCode === 'ADMIN') {
    permissions.add('*');
  }
  return permissions;
}

export async function getPermissionsForRole(roleCode: string): Promise<Set<string>> {
  const cached = permissionCache.get(roleCode);
  if (cached) {
    return cached;
  }

  let permissionCodes: string[];
  try {
    permissionCodes = await permissionRepository.findCodesByRoleCode(roleCode);
  } catch (err) {
    if (typeof (err as { statusCode?: unknown }).statusCode !== 'number') {
      (err as { statusCode: number }).statusCode = 503;
    }
    throw err;
  }
  const permissionSet = withAdminWildcard(roleCode, new Set(permissionCodes));
  permissionCache.set(roleCode, permissionSet);

  return permissionSet;
}

export function clearPermissionCache(roleCode?: string) {
  if (roleCode) {
    permissionCache.delete(roleCode);
    return;
  }
  permissionCache.clear();
}

async function resolveUserPermissions(request: FastifyRequest): Promise<Set<string>> {
  if (!request.user) {
    throw new UnauthorizedError('Usuario nao autenticado');
  }

  if (request.user.permissions && request.user.permissions.length > 0) {
    return withAdminWildcard(request.user.role, new Set(request.user.permissions));
  }

  return getPermissionsForRole(request.user.role);
}

// Exige que o usuario tenha TODAS as permissoes informadas.
export function requirePermission(...requiredPermissions: string[]) {
  return async (request: FastifyRequest) => {
    const userPermissions = await resolveUserPermissions(request);

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.has(permission) || userPermissions.has('*')
    );

    if (!hasAllPermissions) {
      throw new ForbiddenError('Voce nao tem permissao para esta acao');
    }
  };
}

// Exige que o usuario tenha AO MENOS UMA permissao informada.
export function requireAnyPermission(...permissions: string[]) {
  return async (request: FastifyRequest) => {
    const userPermissions = await resolveUserPermissions(request);

    const hasAnyPermission = permissions.some((permission) =>
      userPermissions.has(permission) || userPermissions.has('*')
    );

    if (!hasAnyPermission) {
      throw new ForbiddenError('Voce nao tem permissao para esta acao');
    }
  };
}
