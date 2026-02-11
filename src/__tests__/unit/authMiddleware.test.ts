// src/__tests__/unit/authMiddleware.test.ts

jest.mock('../../modules/auth/services/tokenService', () => ({
  __esModule: true,
  default: {
    verifyToken: jest.fn(),
  },
}));

jest.mock('../../modules/auth/repositories/tokenBlacklistRepository', () => ({
  __esModule: true,
  default: {
    isBlacklisted: jest.fn(),
  },
}));

jest.mock('../../middlewares/permissionMiddleware', () => ({
  getPermissionsForRole: jest.fn(),
}));

import tokenService from '../../modules/auth/services/tokenService';
import tokenBlacklistRepository from '../../modules/auth/repositories/tokenBlacklistRepository';
import { getPermissionsForRole } from '../../middlewares/permissionMiddleware';
import { authenticate } from '../../middlewares/authMiddleware';
import { UnauthorizedError } from '../../utils/errors';

describe('authMiddleware.authenticate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPermissionsForRole as jest.Mock).mockResolvedValue(new Set(['profile:read']));
    (tokenBlacklistRepository.isBlacklisted as jest.Mock).mockResolvedValue(false);
    (tokenService.verifyToken as jest.Mock).mockReturnValue({
      id: 'user-1',
      email: 'user@email.com',
      role: 'RESELLER',
      jti: 'jti-1',
      permissions: [],
    });
  });

  it('deve propagar erro de infraestrutura (5xx) sem converter para 401', async () => {
    const infraError = Object.assign(new Error('database unavailable'), { statusCode: 503 });
    (tokenBlacklistRepository.isBlacklisted as jest.Mock).mockRejectedValue(infraError);

    const request = {
      headers: { authorization: 'Bearer token' },
    } as any;

    await expect(authenticate(request)).rejects.toBe(infraError);
  });

  it('deve propagar erro inesperado sem mascarar como 401', async () => {
    const infraError = new Error('database unavailable');
    (tokenBlacklistRepository.isBlacklisted as jest.Mock).mockRejectedValue(infraError);

    const request = {
      headers: { authorization: 'Bearer token' },
    } as any;

    await expect(authenticate(request)).rejects.toBe(infraError);
  });

  it('deve manter erro 401 para token invalido', async () => {
    (tokenService.verifyToken as jest.Mock).mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    const request = {
      headers: { authorization: 'Bearer token-invalido' },
    } as any;

    await expect(authenticate(request)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
