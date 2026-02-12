import { BruteForceService } from "../../modules/auth/services/bruteForceService";
import { AccountLockedError } from "../../modules/auth/domain/errors/AuthErrors";
import type { UserRepository } from "../../modules/auth/repositories/userRepository";
import type { LoginAttemptsRepository } from "../../modules/auth/repositories/loginAttemptsRepository";
import type { AuditService } from "../../modules/auth/services/auditService";
import { env } from "../../config/env";
import type { User, RequestContext } from "../../types";

const baseContext: RequestContext = {
  ipAddress: "10.0.0.1",
  userAgent: "jest",
};

const baseUser: User = {
  id: "user-1",
  name: "User One",
  email: "user1@test.com",
  password_hash: "hash",
  role: "RESELLER",
  status: "ACTIVE",
  failed_login_attempts: 0,
  last_failed_login_at: null,
  locked_until: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function setup() {
  const userRepository = {
    isAccountLocked: jest.fn(),
    registerFailedLoginAttempt: jest.fn(),
    resetLoginLock: jest.fn(),
  };

  const loginAttemptsRepository = {
    record: jest.fn(),
  };

  const auditService = {
    logBruteForceBlock: jest.fn(),
  };

  const service = new BruteForceService(
    userRepository as unknown as UserRepository,
    loginAttemptsRepository as unknown as LoginAttemptsRepository,
    auditService as unknown as AuditService
  );

  return { service, userRepository, loginAttemptsRepository, auditService };
}

describe("BruteForceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve registrar tentativa de login com sucesso=true", async () => {
    const deps = setup();
    deps.loginAttemptsRepository.record.mockResolvedValue(undefined);

    await deps.service.recordLoginAttempt("user@test.com", baseContext, true);

    expect(deps.loginAttemptsRepository.record).toHaveBeenCalledWith({
      email: "user@test.com",
      ipAddress: "10.0.0.1",
      success: true,
      userAgent: "jest",
    });
  });

  it("deve usar IP padrao quando contexto nao informa ip", async () => {
    const deps = setup();
    deps.loginAttemptsRepository.record.mockResolvedValue(undefined);

    await deps.service.recordLoginAttempt("user@test.com", { userAgent: "jest" }, false);

    expect(deps.loginAttemptsRepository.record).toHaveBeenCalledWith({
      email: "user@test.com",
      ipAddress: "0.0.0.0",
      success: false,
      userAgent: "jest",
    });
  });

  it("nao deve bloquear quando conta nao estiver travada", async () => {
    const deps = setup();
    deps.userRepository.isAccountLocked.mockResolvedValue(false);

    await expect(
      deps.service.checkAndPrepareLoginState(baseUser, baseUser.email, baseContext)
    ).resolves.toBeUndefined();

    expect(deps.loginAttemptsRepository.record).not.toHaveBeenCalled();
    expect(deps.auditService.logBruteForceBlock).not.toHaveBeenCalled();
  });

  it("deve bloquear login quando conta estiver travada", async () => {
    const deps = setup();
    deps.userRepository.isAccountLocked.mockResolvedValue(true);
    deps.loginAttemptsRepository.record.mockResolvedValue(undefined);
    deps.auditService.logBruteForceBlock.mockResolvedValue(undefined);

    await expect(
      deps.service.checkAndPrepareLoginState(baseUser, baseUser.email, baseContext)
    ).rejects.toBeInstanceOf(AccountLockedError);

    expect(deps.loginAttemptsRepository.record).toHaveBeenCalledWith({
      email: "user1@test.com",
      ipAddress: "10.0.0.1",
      success: false,
      userAgent: "jest",
    });
    expect(deps.auditService.logBruteForceBlock).toHaveBeenCalledWith("user1@test.com", baseContext);
  });

  it("deve registrar falha sem bloquear quando limite nao for atingido", async () => {
    const deps = setup();
    deps.userRepository.registerFailedLoginAttempt.mockResolvedValue({
      failedAttempts: 2,
      lockedUntil: null,
      locked: false,
    });

    await deps.service.registerFailedLogin(baseUser, baseUser.email, baseContext);

    expect(deps.userRepository.registerFailedLoginAttempt).toHaveBeenCalledWith(
      "user-1",
      env.MAX_LOGIN_ATTEMPTS,
      env.LOGIN_ATTEMPT_WINDOW_MINUTES,
      env.ACCOUNT_LOCK_DURATION_MINUTES
    );
    expect(deps.auditService.logBruteForceBlock).not.toHaveBeenCalled();
  });

  it("deve registrar evento de bloqueio quando limite for atingido", async () => {
    const deps = setup();
    deps.userRepository.registerFailedLoginAttempt.mockResolvedValue({
      failedAttempts: 0,
      lockedUntil: new Date(Date.now() + 60_000),
      locked: true,
    });
    deps.auditService.logBruteForceBlock.mockResolvedValue(undefined);

    await deps.service.registerFailedLogin(baseUser, baseUser.email, baseContext);

    expect(deps.auditService.logBruteForceBlock).toHaveBeenCalledWith("user1@test.com", baseContext);
  });

  it("deve resetar lock state apos login bem sucedido", async () => {
    const deps = setup();
    deps.userRepository.resetLoginLock.mockResolvedValue(undefined);

    await deps.service.resetOnSuccess({
      id: "user-1",
      failed_login_attempts: 3,
      locked_until: null,
      last_failed_login_at: new Date(),
    });

    expect(deps.userRepository.resetLoginLock).toHaveBeenCalledWith("user-1");
  });

  it("nao deve chamar reset quando usuario nao tem lock state", async () => {
    const deps = setup();

    await deps.service.resetOnSuccess({
      id: "user-1",
      failed_login_attempts: 0,
      locked_until: null,
      last_failed_login_at: null,
    });

    expect(deps.userRepository.resetLoginLock).not.toHaveBeenCalled();
  });
});

