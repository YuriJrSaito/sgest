// src/modules/auth/container.ts
// Container de injecao de dependencia do modulo auth (tsyringe)

import { container } from "tsyringe";
import { AUTH_TOKENS } from "./tokens";

// Repositories (singletons concretos)
import userRepository from "./repositories/userRepository";
import refreshTokenRepository from "./repositories/refreshTokenRepository";
import tokenBlacklistRepository from "./repositories/tokenBlacklistRepository";
import permissionRepository from "../permissions/repositories/permissionRepository";
import loginAttemptsRepository from "./repositories/loginAttemptsRepository";
import auditLogRepository from "./repositories/auditLogRepository";

// Services (singletons concretos)
import tokenService from "./services/tokenService";
import passwordService from "./services/passwordService";
import transactionManager from "./services/transactionManager";

// Services (@injectable - resolvidos pelo container)
import { AuditService } from "./services/auditService";
import { BruteForceService } from "./services/bruteForceService";

// === Registrar repositorios ===
container.registerInstance(AUTH_TOKENS.UserRepository, userRepository);
container.registerInstance(AUTH_TOKENS.RefreshTokenRepository, refreshTokenRepository);
container.registerInstance(AUTH_TOKENS.TokenBlacklistRepository, tokenBlacklistRepository);
container.registerInstance(AUTH_TOKENS.PermissionRepository, permissionRepository);
container.registerInstance(AUTH_TOKENS.LoginAttemptsRepository, loginAttemptsRepository);
container.registerInstance(AUTH_TOKENS.AuditLogRepository, auditLogRepository);

// === Registrar services (singletons) ===
container.registerInstance(AUTH_TOKENS.TokenService, tokenService);
container.registerInstance(AUTH_TOKENS.PasswordService, passwordService);
container.registerInstance(AUTH_TOKENS.ITransactionManager, transactionManager);

// === Registrar services por classe (sem token simbolico) ===
container.registerSingleton(AuditService);
container.registerSingleton(BruteForceService);

// Reset para testes
export function resetContainer(): void {
  container.clearInstances();
}

export { container };
