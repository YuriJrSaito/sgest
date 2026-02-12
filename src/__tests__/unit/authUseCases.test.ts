// src/__tests__/unit/authUseCases.test.ts
// Testes unitarios dos Use Cases de autenticacao

import bcrypt from 'bcrypt';
import { LoginUseCase } from '../../modules/auth/useCases/login/LoginUseCase';
import { LogoutUseCase } from '../../modules/auth/useCases/logout/LogoutUseCase';
import { LogoutAllUseCase } from '../../modules/auth/useCases/logout/LogoutAllUseCase';
import { ChangePasswordUseCase } from '../../modules/auth/useCases/changePassword/ChangePasswordUseCase';
import { GetProfileUseCase } from '../../modules/auth/useCases/profile/GetProfileUseCase';
import { UpdateProfileUseCase } from '../../modules/auth/useCases/profile/UpdateProfileUseCase';
import { GetSessionsUseCase } from '../../modules/auth/useCases/sessions/GetSessionsUseCase';
import { RevokeSessionUseCase } from '../../modules/auth/useCases/sessions/RevokeSessionUseCase';
import tokenService from '../../modules/auth/services/tokenService';
import { InvalidCredentialsError, InactiveUserError, InvalidCurrentPasswordError } from '../../modules/auth/domain/errors/AuthErrors';
import { DomainConflictError } from '../../modules/auth/domain/errors/DomainErrors';
import { UserRole, UserStatus } from '../../types';
import type { UserRepository } from '../../modules/auth/repositories/userRepository';
import type { RefreshTokenRepository } from '../../modules/auth/repositories/refreshTokenRepository';
import type { TokenBlacklistRepository } from '../../modules/auth/repositories/tokenBlacklistRepository';
import type { PermissionRepository } from '../../modules/permissions/repositories/permissionRepository';
import type { TokenService } from '../../modules/auth/services/tokenService';
import type { PasswordService } from '../../modules/auth/services/passwordService';
import type { BruteForceService } from '../../modules/auth/services/bruteForceService';
import type { AuditService } from '../../modules/auth/services/auditService';
import type { ITransactionManager } from '../../modules/auth/services/interfaces/ITransactionManager';
import type { TransactionContext } from '../../modules/auth/types';

// Mock dos repositories
jest.mock('../../modules/auth/repositories/userRepository');
jest.mock('../../modules/auth/repositories/refreshTokenRepository');
jest.mock('../../modules/auth/repositories/tokenBlacklistRepository');
jest.mock('../../modules/auth/repositories/loginAttemptsRepository');
jest.mock('../../modules/permissions/repositories/permissionRepository');
jest.mock('../../modules/auth/repositories/auditLogRepository');
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: (ctx: { query: jest.Mock }) => Promise<unknown>) => cb({ query: jest.fn() })),
    query: jest.fn(),
  },
}));

// Importar mocks de repositories
import userRepository from '../../modules/auth/repositories/userRepository';
import refreshTokenRepository from '../../modules/auth/repositories/refreshTokenRepository';
import tokenBlacklistRepository from '../../modules/auth/repositories/tokenBlacklistRepository';
import permissionRepository from '../../modules/permissions/repositories/permissionRepository';

// Mock objects para services injetados via constructor
const auditService = {
  log: jest.fn().mockResolvedValue(undefined),
  logLogin: jest.fn().mockResolvedValue(undefined),
  logLogout: jest.fn().mockResolvedValue(undefined),
  logPasswordChange: jest.fn().mockResolvedValue(undefined),
  logTokenRefresh: jest.fn().mockResolvedValue(undefined),
  logTokenReuseDetected: jest.fn().mockResolvedValue(undefined),
  logBruteForceBlock: jest.fn().mockResolvedValue(undefined),
  getByUserId: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, lastPage: 1 } }),
  getRecentLoginHistory: jest.fn().mockResolvedValue([]),
  getUserStats: jest.fn().mockResolvedValue({ totalLogins: 0, failedLogins: 0 }),
  getSuspiciousActivityByIp: jest.fn().mockResolvedValue([]),
};

const bruteForceService = {
  recordLoginAttempt: jest.fn().mockResolvedValue(undefined),
  checkAndPrepareLoginState: jest.fn().mockResolvedValue(0),
  registerFailedLogin: jest.fn().mockResolvedValue(undefined),
  resetOnSuccess: jest.fn().mockResolvedValue(undefined),
};

const transactionManager = {
  transaction: jest.fn(async (callback: (ctx: TransactionContext) => Promise<unknown>) =>
    callback({ query: jest.fn() } as unknown as TransactionContext)
  ),
};

// Mock passwordService para usar bcrypt real nos testes (hash/compare)
import passwordService from '../../modules/auth/services/passwordService';
jest.mock('../../modules/auth/services/passwordService', () => ({
  __esModule: true,
  default: {
    hash: jest.fn((password: string) => require('bcrypt').hash(password, 10)),
    compare: jest.fn((password: string, hash: string) => require('bcrypt').compare(password, hash)),
  },
}));

describe('Auth Use Cases', () => {
  const mockContext = {
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock padrao para permissoes
    (permissionRepository.findCodesByRoleCode as jest.Mock).mockResolvedValue(['READ_PRODUCTS']);
    // Re-setup passwordService mocks (cleared by clearAllMocks)
    (passwordService.hash as jest.Mock).mockImplementation((password: string) => require('bcrypt').hash(password, 10));
    (passwordService.compare as jest.Mock).mockImplementation((password: string, hash: string) => require('bcrypt').compare(password, hash));
  });

  describe('LoginUseCase', () => {
    let loginUseCase: LoginUseCase;

    beforeEach(() => {
      loginUseCase = new LoginUseCase(
        userRepository as unknown as UserRepository,
        refreshTokenRepository as unknown as RefreshTokenRepository,
        tokenService as unknown as TokenService,
        passwordService as unknown as PasswordService,
        bruteForceService as unknown as BruteForceService,
        auditService as unknown as AuditService,
        permissionRepository as unknown as PermissionRepository
      );
      (refreshTokenRepository.create as jest.Mock).mockResolvedValue({
        id: 'refresh-token-id',
        user_id: '123',
        token_hash: 'hash',
        jti: 'jti-123',
        family_id: 'family-123',
      });
    });

    it('deve fazer login com sucesso', async () => {
      const passwordHash = await bcrypt.hash('senha123', 10);
      const mockUser = {
        id: '123',
        name: 'Joao Silva',
        email: 'joao@email.com',
        password_hash: passwordHash,
        role: 'RESELLER' as UserRole,
        status: 'ACTIVE' as UserStatus,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (userRepository.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await loginUseCase.execute(
        { email: 'joao@email.com', password: 'senha123' },
        mockContext
      );

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result.user.id).toBe('123');
      expect(result.user.email).toBe('joao@email.com');
      expect(result.user).not.toHaveProperty('password_hash');
      expect(auditService.logLogin).toHaveBeenCalledWith('123', 'joao@email.com', 'success', mockContext);
    });

    it('deve lancar erro se usuario nao existir', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        loginUseCase.execute({ email: 'naoexiste@email.com', password: 'senha123' }, mockContext)
      ).rejects.toThrow(InvalidCredentialsError);

      expect(auditService.logLogin).toHaveBeenCalledWith(
        undefined, 'naoexiste@email.com', 'failure', mockContext, undefined
      );
    });

    it('deve lancar erro se senha estiver incorreta', async () => {
      const passwordHash = await bcrypt.hash('senhaCorreta', 10);
      const mockUser = {
        id: '123',
        email: 'joao@email.com',
        password_hash: passwordHash,
        status: 'ACTIVE' as UserStatus,
        role: 'RESELLER' as UserRole,
      };

      (userRepository.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        loginUseCase.execute({ email: 'joao@email.com', password: 'senhaErrada' }, mockContext)
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('deve lancar erro se usuario estiver inativo', async () => {
      const passwordHash = await bcrypt.hash('senha123', 10);
      const mockUser = {
        id: '123',
        email: 'joao@email.com',
        password_hash: passwordHash,
        status: 'INACTIVE' as UserStatus,
        role: 'RESELLER' as UserRole,
      };

      (userRepository.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        loginUseCase.execute({ email: 'joao@email.com', password: 'senha123' }, mockContext)
      ).rejects.toThrow(InactiveUserError);
    });
  });

  describe('LogoutUseCase', () => {
    let logoutUseCase: LogoutUseCase;

    beforeEach(() => {
      logoutUseCase = new LogoutUseCase(
        refreshTokenRepository as unknown as RefreshTokenRepository,
        tokenService as unknown as TokenService,
        tokenBlacklistRepository as unknown as TokenBlacklistRepository,
        auditService as unknown as AuditService,
        transactionManager as unknown as ITransactionManager
      );
    });

    it('deve fazer logout com sucesso', async () => {
      const mockUser = {
        id: '123',
        email: 'joao@email.com',
        role: 'RESELLER' as UserRole,
      };

      const accessToken = tokenService.generateAccessToken(mockUser, 'test-jti');

      await logoutUseCase.execute({ userId: '123', accessToken }, mockContext);

      expect(tokenBlacklistRepository.add).toHaveBeenCalled();
      expect(auditService.logLogout).toHaveBeenCalledWith('123', mockContext, false);
    });

    it('deve revogar refresh token se fornecido', async () => {
      const mockUser = {
        id: '123',
        email: 'joao@email.com',
        role: 'RESELLER' as UserRole,
      };

      const accessToken = tokenService.generateAccessToken(mockUser, 'test-jti');
      (refreshTokenRepository.findByTokenHash as jest.Mock).mockResolvedValue({
        user_id: '123',
        jti: 'refresh-jti',
      });

      await logoutUseCase.execute(
        { userId: '123', accessToken, refreshToken: 'refresh-token' },
        mockContext
      );

      expect(refreshTokenRepository.revokeByJti).toHaveBeenCalledWith(
        'refresh-jti',
        undefined,
        expect.any(Object)
      );
    });
  });

  describe('LogoutAllUseCase', () => {
    let logoutAllUseCase: LogoutAllUseCase;

    beforeEach(() => {
      logoutAllUseCase = new LogoutAllUseCase(
        refreshTokenRepository as unknown as RefreshTokenRepository,
        tokenService as unknown as TokenService,
        tokenBlacklistRepository as unknown as TokenBlacklistRepository,
        auditService as unknown as AuditService,
        transactionManager as unknown as ITransactionManager
      );
    });

    it('deve fazer logout de todos os dispositivos', async () => {
      const mockUser = {
        id: '123',
        email: 'joao@email.com',
        role: 'RESELLER' as UserRole,
      };

      const accessToken = tokenService.generateAccessToken(mockUser, 'test-jti');

      await logoutAllUseCase.execute({ userId: '123', accessToken }, mockContext);

      expect(tokenBlacklistRepository.add).toHaveBeenCalled();
      expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith(
        '123',
        expect.any(Object)
      );
      expect(auditService.logLogout).toHaveBeenCalledWith('123', mockContext, true);
    });
  });

  describe('ChangePasswordUseCase', () => {
    let changePasswordUseCase: ChangePasswordUseCase;

    beforeEach(() => {
      changePasswordUseCase = new ChangePasswordUseCase(
        userRepository as unknown as UserRepository,
        refreshTokenRepository as unknown as RefreshTokenRepository,
        passwordService as unknown as PasswordService,
        tokenService as unknown as TokenService,
        tokenBlacklistRepository as unknown as TokenBlacklistRepository,
        auditService as unknown as AuditService,
        transactionManager as unknown as ITransactionManager
      );
    });

    it('deve alterar senha com sucesso', async () => {
      const currentPasswordHash = await bcrypt.hash('senhaAtual', 10);
      const mockUser = {
        id: '123',
        email: 'joao@email.com',
        password_hash: currentPasswordHash,
      };

      (userRepository.findByIdWithPassword as jest.Mock).mockResolvedValue(mockUser);

      await changePasswordUseCase.execute(
        { userId: '123', currentPassword: 'senhaAtual', newPassword: 'novaSenha123' },
        mockContext
      );

      expect(userRepository.updatePassword).toHaveBeenCalledWith('123', expect.any(String), expect.any(Object));
      expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('123', expect.any(Object));
      expect(auditService.logPasswordChange).toHaveBeenCalledWith('123', mockContext);
    });

    it('deve lancar erro se senha atual estiver incorreta', async () => {
      const currentPasswordHash = await bcrypt.hash('senhaAtual', 10);
      const mockUser = {
        id: '123',
        email: 'joao@email.com',
        password_hash: currentPasswordHash,
      };

      (userRepository.findByIdWithPassword as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        changePasswordUseCase.execute(
          { userId: '123', currentPassword: 'senhaErrada', newPassword: 'novaSenha123' },
          mockContext
        )
      ).rejects.toThrow(InvalidCurrentPasswordError);
    });
  });

  describe('GetProfileUseCase', () => {
    let getProfileUseCase: GetProfileUseCase;

    beforeEach(() => {
      getProfileUseCase = new GetProfileUseCase(
        userRepository as unknown as UserRepository,
        permissionRepository as unknown as PermissionRepository
      );
    });

    it('deve retornar perfil do usuario', async () => {
      const mockUser = {
        id: '123',
        name: 'Joao Silva',
        email: 'joao@email.com',
        role: 'RESELLER' as UserRole,
        status: 'ACTIVE' as UserStatus,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (userRepository.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await getProfileUseCase.execute({ userId: '123' });

      expect(result.id).toBe('123');
      expect(result.name).toBe('Joao Silva');
      expect(result.email).toBe('joao@email.com');
      expect(result.permissions).toContain('READ_PRODUCTS');
    });
  });

  describe('UpdateProfileUseCase', () => {
    let updateProfileUseCase: UpdateProfileUseCase;

    beforeEach(() => {
      updateProfileUseCase = new UpdateProfileUseCase(
        userRepository as unknown as UserRepository,
        permissionRepository as unknown as PermissionRepository
      );
    });

    it('deve atualizar perfil com sucesso', async () => {
      const mockUser = {
        id: '123',
        name: 'Joao Atualizado',
        email: 'joao@email.com',
        role: 'RESELLER' as UserRole,
        status: 'ACTIVE' as UserStatus,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (userRepository.emailExists as jest.Mock).mockResolvedValue(false);
      (userRepository.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await updateProfileUseCase.execute({
        userId: '123',
        name: 'Joao Atualizado',
      });

      expect(result.name).toBe('Joao Atualizado');
      expect(userRepository.update).toHaveBeenCalledWith('123', { name: 'Joao Atualizado' });
    });

    it('deve lancar erro se email ja existir', async () => {
      (userRepository.emailExists as jest.Mock).mockResolvedValue(true);

      await expect(
        updateProfileUseCase.execute({ userId: '123', email: 'existente@email.com' })
      ).rejects.toThrow(DomainConflictError);
    });
  });

  describe('GetSessionsUseCase', () => {
    let getSessionsUseCase: GetSessionsUseCase;

    beforeEach(() => {
      getSessionsUseCase = new GetSessionsUseCase(
        refreshTokenRepository as unknown as RefreshTokenRepository
      );
    });

    it('deve listar sessoes ativas', async () => {
      const mockTokens = [
        {
          id: 'session-1',
          token_hash: 'hash1',
          user_agent: 'Chrome',
          ip_address: '192.168.1.1',
          created_at: new Date(),
        },
        {
          id: 'session-2',
          token_hash: 'hash2',
          user_agent: 'Firefox',
          ip_address: '192.168.1.2',
          created_at: new Date(),
        },
      ];

      (refreshTokenRepository.findActiveByUserId as jest.Mock).mockResolvedValue(mockTokens);

      const result = await getSessionsUseCase.execute({ userId: '123' });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-1');
      expect(result[1].id).toBe('session-2');
    });

    it('deve marcar sessao atual corretamente', async () => {
      const mockTokens = [
        {
          id: 'session-1',
          token_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          user_agent: 'Chrome',
          ip_address: '192.168.1.1',
          created_at: new Date(),
        },
      ];

      (refreshTokenRepository.findActiveByUserId as jest.Mock).mockResolvedValue(mockTokens);

      const result = await getSessionsUseCase.execute({
        userId: '123',
        currentRefreshToken: 'current-token',
      });

      expect(result[0].is_current).toBe(false);
    });
  });

  describe('RevokeSessionUseCase', () => {
    let revokeSessionUseCase: RevokeSessionUseCase;

    beforeEach(() => {
      revokeSessionUseCase = new RevokeSessionUseCase(
        refreshTokenRepository as unknown as RefreshTokenRepository,
        auditService as unknown as AuditService,
        transactionManager as unknown as ITransactionManager
      );
    });

    it('deve revogar sessao com sucesso', async () => {
      const mockTokens = [
        { id: 'session-1', jti: 'jti-1' },
        { id: 'session-2', jti: 'jti-2' },
      ];

      (refreshTokenRepository.findActiveByUserId as jest.Mock).mockResolvedValue(mockTokens);

      await revokeSessionUseCase.execute({ userId: '123', sessionId: 'session-1' }, mockContext);

      expect(refreshTokenRepository.revokeByJti).toHaveBeenCalledWith('jti-1', undefined, expect.anything());
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        userId: '123',
        action: 'session_revoked',
        resourceId: 'session-1',
      }));
    });

    it('deve lancar erro se sessao nao existir', async () => {
      (refreshTokenRepository.findActiveByUserId as jest.Mock).mockResolvedValue([]);

      await expect(
        revokeSessionUseCase.execute({ userId: '123', sessionId: 'inexistente' }, mockContext)
      ).rejects.toThrow('Sessao nao encontrada');
    });
  });

  describe('TokenService', () => {
    it('deve gerar access token JWT valido', () => {
      const mockUser = {
        id: '123',
        email: 'joao@email.com',
        role: 'RESELLER' as UserRole,
      };

      const token = tokenService.generateAccessToken(mockUser, 'test-jti');

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = tokenService.verifyToken(token);
      expect(decoded).toHaveProperty('jti', 'test-jti');
      expect(decoded).toHaveProperty('id', '123');
    });

    it('deve gerar refresh token aleatorio', () => {
      const token = tokenService.generateRefreshToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBe(80);
    });

    it('deve lancar erro com token invalido', () => {
      expect(() => {
        tokenService.verifyToken('token-invalido');
      }).toThrow();
    });
  });
});
