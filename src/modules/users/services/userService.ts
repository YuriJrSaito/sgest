import userRepository from '../../auth/repositories/userRepository';
import {
  User,
  UserListParams,
  PaginatedResponse,
} from '../../../types';
import { ForbiddenError } from '../../../utils/errors';
import { hasPermission } from '../../../utils/permissionUtils';
import type { AuthenticatedUser } from '../../../types/auth';

class UserService {
  async list(params: UserListParams, user: AuthenticatedUser): Promise<PaginatedResponse<User>> {
    if (!hasPermission(user, 'users:read')) {
      throw new ForbiddenError('Voce nao tem permissao para listar usuarios');
    }

    return userRepository.findAllWithFilters(params);
  }
}

export default new UserService();
