// src/__tests__/unit/containerWiring.test.ts
// Testa que o container DI resolve todos os Use Cases e Controllers corretamente

jest.mock('../../modules/auth/repositories/userRepository');
jest.mock('../../modules/auth/repositories/refreshTokenRepository');
jest.mock('../../modules/auth/repositories/tokenBlacklistRepository');
jest.mock('../../modules/auth/repositories/loginAttemptsRepository');
jest.mock('../../modules/auth/repositories/auditLogRepository');
jest.mock('../../modules/auth/services/passwordService');
jest.mock('../../modules/permissions/repositories/permissionRepository');
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: any) => cb({ query: jest.fn() })),
    query: jest.fn(),
  },
}));

import {
  container,
} from '../../modules/auth/container';

import { LoginUseCase } from '../../modules/auth/useCases/login/LoginUseCase';
import { RefreshTokenUseCase } from '../../modules/auth/useCases/refreshToken/RefreshTokenUseCase';
import { LogoutUseCase } from '../../modules/auth/useCases/logout/LogoutUseCase';
import { LogoutAllUseCase } from '../../modules/auth/useCases/logout/LogoutAllUseCase';
import { ChangePasswordUseCase } from '../../modules/auth/useCases/changePassword/ChangePasswordUseCase';
import { GetProfileUseCase } from '../../modules/auth/useCases/profile/GetProfileUseCase';
import { UpdateProfileUseCase } from '../../modules/auth/useCases/profile/UpdateProfileUseCase';
import { GetSessionsUseCase } from '../../modules/auth/useCases/sessions/GetSessionsUseCase';
import { RevokeSessionUseCase } from '../../modules/auth/useCases/sessions/RevokeSessionUseCase';
import { AuthController } from '../../modules/auth/controllers/authController';
import { AuditController } from '../../modules/auth/controllers/auditController';

describe('Container Wiring', () => {
  it('deve resolver LoginUseCase', () => {
    expect(container.resolve(LoginUseCase)).toBeInstanceOf(LoginUseCase);
  });

  it('deve resolver RefreshTokenUseCase', () => {
    expect(container.resolve(RefreshTokenUseCase)).toBeInstanceOf(RefreshTokenUseCase);
  });

  it('deve resolver LogoutUseCase', () => {
    expect(container.resolve(LogoutUseCase)).toBeInstanceOf(LogoutUseCase);
  });

  it('deve resolver LogoutAllUseCase', () => {
    expect(container.resolve(LogoutAllUseCase)).toBeInstanceOf(LogoutAllUseCase);
  });

  it('deve resolver ChangePasswordUseCase', () => {
    expect(container.resolve(ChangePasswordUseCase)).toBeInstanceOf(ChangePasswordUseCase);
  });

  it('deve resolver GetProfileUseCase', () => {
    expect(container.resolve(GetProfileUseCase)).toBeInstanceOf(GetProfileUseCase);
  });

  it('deve resolver UpdateProfileUseCase', () => {
    expect(container.resolve(UpdateProfileUseCase)).toBeInstanceOf(UpdateProfileUseCase);
  });

  it('deve resolver GetSessionsUseCase', () => {
    expect(container.resolve(GetSessionsUseCase)).toBeInstanceOf(GetSessionsUseCase);
  });

  it('deve resolver RevokeSessionUseCase', () => {
    expect(container.resolve(RevokeSessionUseCase)).toBeInstanceOf(RevokeSessionUseCase);
  });

  it('deve resolver AuthController', () => {
    expect(container.resolve(AuthController)).toBeInstanceOf(AuthController);
  });

  it('deve resolver AuditController', () => {
    expect(container.resolve(AuditController)).toBeInstanceOf(AuditController);
  });
});
