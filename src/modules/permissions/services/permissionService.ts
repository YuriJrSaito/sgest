import permissionRepository from '../repositories/permissionRepository';
import { clearPermissionCache } from '../../../middlewares/permissionMiddleware';
import { Permission, RoleWithPermissions } from '../../../types';

class PermissionService {
  async listPermissions(): Promise<Permission[]> {
    return permissionRepository.listAll();
  }

  async listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    return permissionRepository.listRolesWithPermissions();
  }

  async updateRolePermissions(roleCode: string, permissionIds: string[]): Promise<RoleWithPermissions> {
    const role = await permissionRepository.updateRolePermissions(roleCode, permissionIds);
    clearPermissionCache(roleCode);
    return role;
  }
}

export default new PermissionService();
