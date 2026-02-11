import type { PermissionCode, UserRole } from '../types';
import type { AuthenticatedUser } from '../types/auth';

export type LegacyPermissionMap = Partial<Record<UserRole, PermissionCode[]>>;

export function hasPermission(
  user: AuthenticatedUser,
  permission: PermissionCode,
  legacyByRole: LegacyPermissionMap = {}
): boolean {
  if (user.role === 'ADMIN') return true;

  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }

  const legacy = legacyByRole[user.role] || [];
  return legacy.includes(permission);
}
