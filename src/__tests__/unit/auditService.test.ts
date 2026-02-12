import { AuditService } from "../../modules/auth/services/auditService";
import type { AuditLogRepository } from "../../modules/auth/repositories/auditLogRepository";
import type { AuditLog, PaginatedResponse, RequestContext } from "../../types";

const mockLoggerError = jest.fn();

jest.mock("../../config/logger", () => ({
  getAuthLogger: () => ({
    error: mockLoggerError,
  }),
}));

type MockAuditLogRepository = {
  create: jest.Mock;
  findByUserId: jest.Mock;
  findLoginHistoryByUserId: jest.Mock;
  findRecentLoginsByUserId: jest.Mock;
  getStatsByUserId: jest.Mock;
  findByIpAddress: jest.Mock;
};

const context: RequestContext = {
  ipAddress: "127.0.0.1",
  userAgent: "jest",
};

function setup() {
  const repository: MockAuditLogRepository = {
    create: jest.fn(),
    findByUserId: jest.fn(),
    findLoginHistoryByUserId: jest.fn(),
    findRecentLoginsByUserId: jest.fn(),
    getStatsByUserId: jest.fn(),
    findByIpAddress: jest.fn(),
  };

  const service = new AuditService(repository as unknown as AuditLogRepository);
  return { service, repository };
}

describe("AuditService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve persistir log com sucesso", async () => {
    const { service, repository } = setup();
    repository.create.mockResolvedValue({ id: "log-1" });

    await expect(
      service.log({
        userId: "user-1",
        action: "login",
        status: "success",
      })
    ).resolves.toBeUndefined();

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      action: "login",
      status: "success",
    });
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it("deve ser best-effort e nao propagar erro do repositorio", async () => {
    const { service, repository } = setup();
    const dbError = new Error("db down");
    repository.create.mockRejectedValue(dbError);

    await expect(
      service.log({
        userId: "user-1",
        action: "login",
        status: "failure",
      })
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: dbError,
        auditData: expect.objectContaining({
          userId: "user-1",
          action: "login",
          status: "failure",
        }),
      }),
      "Erro ao registrar log de auditoria"
    );
  });

  it("deve mapear logLogin para acao de sucesso e metadata de email", async () => {
    const { service, repository } = setup();
    repository.create.mockResolvedValue({ id: "log-1" });

    await service.logLogin("user-1", "user@test.com", "success", context, { source: "web" });

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      action: "login",
      resourceType: "auth",
      resourceId: "user@test.com",
      status: "success",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      metadata: {
        email: "user@test.com",
        source: "web",
      },
    });
  });

  it("deve mapear logLogout com logoutAll true", async () => {
    const { service, repository } = setup();
    repository.create.mockResolvedValue({ id: "log-1" });

    await service.logLogout("user-1", context, true);

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      action: "logout_all",
      resourceType: "auth",
      status: "success",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      metadata: { logoutAll: true },
    });
  });

  it("deve mapear logTokenReuseDetected com severidade alta", async () => {
    const { service, repository } = setup();
    repository.create.mockResolvedValue({ id: "log-1" });

    await service.logTokenReuseDetected("user-1", context);

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      action: "token_reuse_detected",
      resourceType: "security",
      status: "blocked",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
      metadata: {
        severity: "high",
        action_taken: "revoked_token_family",
      },
    });
  });

  it("deve delegar getByUserId para o repositorio", async () => {
    const { service, repository } = setup();
    const response: PaginatedResponse<AuditLog> = {
      data: [],
      meta: { total: 0, page: 1, lastPage: 1 },
    };
    repository.findByUserId.mockResolvedValue(response);

    const result = await service.getByUserId("user-1", { page: 1, limit: 10 });

    expect(repository.findByUserId).toHaveBeenCalledWith("user-1", { page: 1, limit: 10 });
    expect(result).toBe(response);
  });

  it("deve delegar getUserStats para o repositorio", async () => {
    const { service, repository } = setup();
    const stats = {
      totalLogins: 5,
      failedLogins: 2,
      lastLogin: new Date(),
      lastIpAddress: "10.0.0.1",
    };
    repository.getStatsByUserId.mockResolvedValue(stats);

    const result = await service.getUserStats("user-1");

    expect(repository.getStatsByUserId).toHaveBeenCalledWith("user-1");
    expect(result).toBe(stats);
  });
});
