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

import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../../types';
import tokenService from '../../modules/auth/services/tokenService';
import tokenBlacklistRepository from '../../modules/auth/repositories/tokenBlacklistRepository';
import { getPermissionsForRole } from '../../middlewares/permissionMiddleware';
import { authenticate, optionalAuth, authorize } from '../../middlewares/authMiddleware';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';

type TestRequest = {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
};

function makeRequest(overrides: Partial<TestRequest> = {}): TestRequest {
  return {
    headers: {},
    ...overrides,
  };
}

function toFastifyRequest(request: TestRequest): FastifyRequest {
  return request as unknown as FastifyRequest;
}

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

  it('deve preencher request.user no caminho feliz', async () => {
    const request = makeRequest({
      headers: { authorization: 'Bearer token-valido' },
    });

    await expect(authenticate(toFastifyRequest(request))).resolves.toBeUndefined();
    expect(request.user).toMatchObject({
      id: 'user-1',
      email: 'user@email.com',
      role: 'RESELLER',
      permissions: ['profile:read'],
    });
    expect(getPermissionsForRole).toHaveBeenCalledWith('RESELLER');
  });

  it('deve usar permissoes do proprio token quando presentes', async () => {
    (tokenService.verifyToken as jest.Mock).mockReturnValue({
      id: 'user-1',
      email: 'user@email.com',
      role: 'RESELLER',
      jti: 'jti-1',
      permissions: ['products:read'],
    });

    const request = makeRequest({
      headers: { authorization: 'Bearer token-com-permissoes' },
    });

    await expect(authenticate(toFastifyRequest(request))).resolves.toBeUndefined();
    expect(request.user.permissions).toEqual(['products:read']);
    expect(getPermissionsForRole).not.toHaveBeenCalled();
  });

  it('deve retornar 401 quando header Authorization nao existe', async () => {
    const request = makeRequest();
    await expect(authenticate(toFastifyRequest(request))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('deve retornar 401 quando formato do header e invalido', async () => {
    const request = makeRequest({
      headers: { authorization: 'Basic token' },
    });

    await expect(authenticate(toFastifyRequest(request))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('deve retornar 401 quando token nao possui jti', async () => {
    (tokenService.verifyToken as jest.Mock).mockReturnValue({
      id: 'user-1',
      email: 'user@email.com',
      role: 'RESELLER',
      permissions: [],
    });

    const request = makeRequest({
      headers: { authorization: 'Bearer token-sem-jti' },
    });

    await expect(authenticate(toFastifyRequest(request))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('deve retornar 401 quando token esta na blacklist', async () => {
    (tokenBlacklistRepository.isBlacklisted as jest.Mock).mockResolvedValue(true);
    const request = makeRequest({
      headers: { authorization: 'Bearer token-revogado' },
    });

    await expect(authenticate(toFastifyRequest(request))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('deve propagar erro de infraestrutura (5xx) sem converter para 401', async () => {
    const infraError = Object.assign(new Error('database unavailable'), { statusCode: 503 });
    (tokenBlacklistRepository.isBlacklisted as jest.Mock).mockRejectedValue(infraError);

    const request = makeRequest({
      headers: { authorization: 'Bearer token' },
    });

    await expect(authenticate(toFastifyRequest(request))).rejects.toBe(infraError);
  });

  it('deve propagar erro inesperado sem mascarar como 401', async () => {
    const infraError = new Error('database unavailable');
    (tokenBlacklistRepository.isBlacklisted as jest.Mock).mockRejectedValue(infraError);

    const request = makeRequest({
      headers: { authorization: 'Bearer token' },
    });

    await expect(authenticate(toFastifyRequest(request))).rejects.toBe(infraError);
  });

  it('deve manter erro 401 para token invalido', async () => {
    (tokenService.verifyToken as jest.Mock).mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    const request = makeRequest({
      headers: { authorization: 'Bearer token-invalido' },
    });

    await expect(authenticate(toFastifyRequest(request))).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('authMiddleware.optionalAuth', () => {
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

  it('deve ignorar quando nao houver Authorization header', async () => {
    const request = makeRequest({ user: undefined });
    await expect(optionalAuth(toFastifyRequest(request))).resolves.toBeUndefined();
    expect(request.user).toBeUndefined();
    expect(tokenService.verifyToken).not.toHaveBeenCalled();
  });

  it('deve preencher request.user quando token for valido', async () => {
    const request = makeRequest({
      headers: { authorization: 'Bearer token-valido' },
      user: undefined,
    });

    await expect(optionalAuth(toFastifyRequest(request))).resolves.toBeUndefined();
    expect(request.user).toMatchObject({
      id: 'user-1',
      email: 'user@email.com',
      role: 'RESELLER',
      permissions: ['profile:read'],
    });
  });

  it('deve suprimir erro de token invalido e seguir sem usuario autenticado', async () => {
    (tokenService.verifyToken as jest.Mock).mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const request = makeRequest({
      headers: { authorization: 'Bearer token-invalido' },
      user: { id: 'user-2', email: 'another@email.com', role: 'ADMIN' },
    });

    await expect(optionalAuth(toFastifyRequest(request))).resolves.toBeUndefined();
    expect(request.user).toBeUndefined();
  });

  it('deve propagar erro 5xx em optionalAuth', async () => {
    const infraError = Object.assign(new Error('db down'), { statusCode: 503 });
    (tokenBlacklistRepository.isBlacklisted as jest.Mock).mockRejectedValue(infraError);

    const request = makeRequest({
      headers: { authorization: 'Bearer token-valido' },
    });

    await expect(optionalAuth(toFastifyRequest(request))).rejects.toBe(infraError);
  });
});

describe('authMiddleware.authorize', () => {
  it('deve rejeitar quando usuario nao esta autenticado', async () => {
    const guard = authorize('ADMIN');
    const request = makeRequest({ user: undefined });
    await expect(guard(toFastifyRequest(request))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('deve rejeitar quando role nao esta permitida', async () => {
    const guard = authorize('ADMIN');
    const request = makeRequest({
      user: { id: 'user-1', email: 'user@email.com', role: 'RESELLER' },
    });

    await expect(guard(toFastifyRequest(request))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('deve permitir quando role esta na lista', async () => {
    const guard = authorize('ADMIN', 'RESELLER');
    const request = makeRequest({
      user: { id: 'user-1', email: 'user@email.com', role: 'RESELLER' },
    });

    await expect(guard(toFastifyRequest(request))).resolves.toBeUndefined();
  });
});
