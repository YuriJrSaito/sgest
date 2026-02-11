import { FastifyReply, FastifyRequest } from 'fastify';
import permissionService from '../services/permissionService';

interface RoleCodeParam {
  roleCode: string;
}

interface UpdateRolePermissionsBody {
  permissionIds: string[];
}

class PermissionController {
  async listPermissions(_request: FastifyRequest, reply: FastifyReply) {
    const permissions = await permissionService.listPermissions();
    return reply.send({
      status: 'success',
      data: { permissions },
    });
  }

  async listRoles(_request: FastifyRequest, reply: FastifyReply) {
    const roles = await permissionService.listRolesWithPermissions();
    return reply.send({
      status: 'success',
      data: { roles },
    });
  }

  async updateRolePermissions(
    request: FastifyRequest<{ Params: RoleCodeParam; Body: UpdateRolePermissionsBody }>,
    reply: FastifyReply
  ) {
    const role = await permissionService.updateRolePermissions(
      request.params.roleCode.toUpperCase(),
      request.body.permissionIds || []
    );

    return reply.send({
      status: 'success',
      message: 'Permissoes do papel atualizadas com sucesso',
      data: { role },
    });
  }
}

export default new PermissionController();
