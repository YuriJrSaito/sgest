import { RefreshTokenUseCase } from "../../modules/auth/useCases/refreshToken/RefreshTokenUseCase";
import {
  InactiveUserError,
  InvalidTokenError,
  RefreshInProgressError,
  TokenExpiredError,
  TokenRevokedError,
} from "../../modules/auth/domain/errors/AuthErrors";
import type { UserRepository } from "../../modules/auth/repositories/userRepository";
import type { RefreshTokenRepository } from "../../modules/auth/repositories/refreshTokenRepository";
import type { TokenService } from "../../modules/auth/services/tokenService";
import type { AuditService } from "../../modules/auth/services/auditService";
import type { PermissionRepository } from "../../modules/permissions/repositories/permissionRepository";
import type { ITransactionManager } from "../../modules/auth/services/interfaces/ITransactionManager";
import type { TransactionContext } from "../../modules/auth/types";
import type { UserRole, UserStatus } from "../../types";

type MockTransactionManager = {
  transaction: jest.Mock;
};

const baseContext = {
  ipAddress: "127.0.0.1",
  userAgent: "jest",
};

function buildUser(status: UserStatus = "ACTIVE") {
  return {
    id: "user-1",
    name: "User One",
    email: "user1@test.com",
    role: "RESELLER" as UserRole,
    status,
  };
}

function buildStoredToken(overrides?: Partial<{
  user_id: string;
  jti: string;
  family_id: string;
  revoked: boolean;
  replaced_by_jti: string;
  expires_at: Date;
}>) {
  return {
    user_id: "user-1",
    jti: "old-refresh-jti",
    family_id: "family-1",
    revoked: false,
    replaced_by_jti: undefined,
    expires_at: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function setup() {
  const userRepository = {
    findByIdOrNull: jest.fn(),
  };

  const refreshTokenRepository = {
    findByTokenHashWithLock: jest.fn(),
    revokeByJti: jest.fn(),
    create: jest.fn(),
    revokeFamilyChain: jest.fn(),
  };

  const tokenService = {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    getRefreshTokenExpiresAt: jest.fn(),
    getAccessTokenExpiration: jest.fn(),
  };

  const auditService = {
    logTokenRefresh: jest.fn(),
    logTokenReuseDetected: jest.fn(),
  };

  const permissionRepository = {
    findCodesByRoleCode: jest.fn(),
  };

  const transactionManager: MockTransactionManager = {
    transaction: jest.fn(async (callback: (ctx: TransactionContext) => Promise<unknown>) =>
      callback({} as TransactionContext)
    ),
  };

  const useCase = new RefreshTokenUseCase(
    userRepository as unknown as UserRepository,
    refreshTokenRepository as unknown as RefreshTokenRepository,
    tokenService as unknown as TokenService,
    auditService as unknown as AuditService,
    permissionRepository as unknown as PermissionRepository,
    transactionManager as unknown as ITransactionManager
  );

  return {
    useCase,
    userRepository,
    refreshTokenRepository,
    tokenService,
    auditService,
    permissionRepository,
    transactionManager,
  };
}

describe("RefreshTokenUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve rotacionar refresh token com sucesso", async () => {
    const deps = setup();
    const storedToken = buildStoredToken();
    const user = buildUser();

    deps.refreshTokenRepository.findByTokenHashWithLock.mockResolvedValue(storedToken);
    deps.userRepository.findByIdOrNull.mockResolvedValue(user);
    deps.permissionRepository.findCodesByRoleCode.mockResolvedValue(["profile:read"]);
    deps.tokenService.generateAccessToken.mockReturnValue("access-token-new");
    deps.tokenService.generateRefreshToken.mockReturnValue("refresh-token-new");
    deps.tokenService.getRefreshTokenExpiresAt.mockReturnValue(new Date(Date.now() + 86_400_000));
    deps.tokenService.getAccessTokenExpiration.mockReturnValue("15m");
    deps.refreshTokenRepository.revokeByJti.mockResolvedValue(undefined);
    deps.refreshTokenRepository.create.mockResolvedValue(undefined);
    deps.auditService.logTokenRefresh.mockResolvedValue(undefined);

    const result = await deps.useCase.execute({ refreshToken: "refresh-token-old" }, baseContext);

    expect(result).toEqual({
      accessToken: "access-token-new",
      refreshToken: "refresh-token-new",
      expiresIn: "15m",
      user: {
        id: "user-1",
        name: "User One",
        email: "user1@test.com",
        role: "RESELLER",
        status: "ACTIVE",
        permissions: ["profile:read"],
      },
    });
    expect(deps.refreshTokenRepository.revokeByJti).toHaveBeenCalledWith(
      "old-refresh-jti",
      expect.any(String),
      expect.anything()
    );
    expect(deps.refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        familyId: "family-1",
      }),
      expect.anything()
    );
    expect(deps.auditService.logTokenRefresh).toHaveBeenCalledWith("user-1", baseContext, true);

    const createOrder = deps.refreshTokenRepository.create.mock.invocationCallOrder[0];
    const successLogOrder = deps.auditService.logTokenRefresh.mock.invocationCallOrder[0];
    expect(successLogOrder).toBeGreaterThan(createOrder);
  });

  it("deve retornar erro quando refresh token nao existe", async () => {
    const deps = setup();
    deps.refreshTokenRepository.findByTokenHashWithLock.mockResolvedValue(null);
    deps.auditService.logTokenRefresh.mockResolvedValue(undefined);

    await expect(
      deps.useCase.execute({ refreshToken: "refresh-token-missing" }, baseContext)
    ).rejects.toBeInstanceOf(InvalidTokenError);

    expect(deps.auditService.logTokenRefresh).toHaveBeenCalledWith(undefined, baseContext, false);
    expect(deps.refreshTokenRepository.revokeByJti).not.toHaveBeenCalled();
    expect(deps.refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it("deve revogar familia inteira quando detectar token reuse", async () => {
    const deps = setup();
    const storedToken = buildStoredToken({
      revoked: true,
      replaced_by_jti: "newer-refresh-jti",
    });

    deps.refreshTokenRepository.findByTokenHashWithLock.mockResolvedValue(storedToken);
    deps.refreshTokenRepository.revokeFamilyChain.mockResolvedValue(undefined);
    deps.auditService.logTokenReuseDetected.mockResolvedValue(undefined);

    await expect(
      deps.useCase.execute({ refreshToken: "refresh-token-reused" }, baseContext)
    ).rejects.toBeInstanceOf(TokenRevokedError);

    expect(deps.refreshTokenRepository.revokeFamilyChain).toHaveBeenCalledWith(
      "family-1",
      expect.anything()
    );
    expect(deps.auditService.logTokenReuseDetected).toHaveBeenCalledWith("user-1", baseContext);
  });

  it("deve retornar token revogado sem revogar familia quando nao ha replaced_by_jti", async () => {
    const deps = setup();
    const storedToken = buildStoredToken({
      revoked: true,
      replaced_by_jti: undefined,
    });

    deps.refreshTokenRepository.findByTokenHashWithLock.mockResolvedValue(storedToken);

    await expect(
      deps.useCase.execute({ refreshToken: "refresh-token-revoked" }, baseContext)
    ).rejects.toBeInstanceOf(TokenRevokedError);

    expect(deps.refreshTokenRepository.revokeFamilyChain).not.toHaveBeenCalled();
    expect(deps.auditService.logTokenReuseDetected).not.toHaveBeenCalled();
  });

  it("deve retornar erro quando refresh token estiver expirado", async () => {
    const deps = setup();
    const storedToken = buildStoredToken({
      expires_at: new Date(Date.now() - 1_000),
    });

    deps.refreshTokenRepository.findByTokenHashWithLock.mockResolvedValue(storedToken);
    deps.auditService.logTokenRefresh.mockResolvedValue(undefined);

    await expect(
      deps.useCase.execute({ refreshToken: "refresh-token-expired" }, baseContext)
    ).rejects.toBeInstanceOf(TokenExpiredError);

    expect(deps.auditService.logTokenRefresh).toHaveBeenCalledWith("user-1", baseContext, false);
  });

  it("deve tratar usuario inexistente como token invalido", async () => {
    const deps = setup();
    const storedToken = buildStoredToken();

    deps.refreshTokenRepository.findByTokenHashWithLock.mockResolvedValue(storedToken);
    deps.userRepository.findByIdOrNull.mockResolvedValue(null);
    deps.auditService.logTokenRefresh.mockResolvedValue(undefined);

    await expect(
      deps.useCase.execute({ refreshToken: "refresh-token-orphan" }, baseContext)
    ).rejects.toBeInstanceOf(InvalidTokenError);

    expect(deps.auditService.logTokenRefresh).toHaveBeenCalledWith("user-1", baseContext, false);
  });

  it("deve retornar erro quando usuario estiver inativo", async () => {
    const deps = setup();
    const storedToken = buildStoredToken();
    const inactiveUser = buildUser("INACTIVE");

    deps.refreshTokenRepository.findByTokenHashWithLock.mockResolvedValue(storedToken);
    deps.userRepository.findByIdOrNull.mockResolvedValue(inactiveUser);
    deps.auditService.logTokenRefresh.mockResolvedValue(undefined);

    await expect(
      deps.useCase.execute({ refreshToken: "refresh-token-inactive-user" }, baseContext)
    ).rejects.toBeInstanceOf(InactiveUserError);

    expect(deps.auditService.logTokenRefresh).toHaveBeenCalledWith("user-1", baseContext, false);
  });

  it("deve propagar erro de lock timeout no refresh", async () => {
    const deps = setup();
    deps.refreshTokenRepository.findByTokenHashWithLock.mockRejectedValue(new RefreshInProgressError());

    await expect(
      deps.useCase.execute({ refreshToken: "refresh-token-locked" }, baseContext)
    ).rejects.toBeInstanceOf(RefreshInProgressError);

    expect(deps.auditService.logTokenRefresh).not.toHaveBeenCalled();
  });

  it("deve deduplicar requests simultaneos com o mesmo refresh token", async () => {
    const deps = setup();
    const storedToken = buildStoredToken();
    const user = buildUser();

    deps.transactionManager.transaction.mockImplementation(
      (callback: (ctx: TransactionContext) => Promise<unknown>) =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            callback({} as TransactionContext).then(resolve).catch(reject);
          }, 20);
        })
    );

    deps.refreshTokenRepository.findByTokenHashWithLock.mockResolvedValue(storedToken);
    deps.userRepository.findByIdOrNull.mockResolvedValue(user);
    deps.permissionRepository.findCodesByRoleCode.mockResolvedValue(["profile:read"]);
    deps.tokenService.generateAccessToken.mockReturnValue("access-token-new");
    deps.tokenService.generateRefreshToken.mockReturnValue("refresh-token-new");
    deps.tokenService.getRefreshTokenExpiresAt.mockReturnValue(new Date(Date.now() + 86_400_000));
    deps.tokenService.getAccessTokenExpiration.mockReturnValue("15m");
    deps.refreshTokenRepository.revokeByJti.mockResolvedValue(undefined);
    deps.refreshTokenRepository.create.mockResolvedValue(undefined);
    deps.auditService.logTokenRefresh.mockResolvedValue(undefined);

    const p1 = deps.useCase.execute({ refreshToken: "refresh-token-same" }, baseContext);
    const p2 = deps.useCase.execute({ refreshToken: "refresh-token-same" }, baseContext);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toEqual(r2);
    expect(deps.transactionManager.transaction).toHaveBeenCalledTimes(1);
  });
});
