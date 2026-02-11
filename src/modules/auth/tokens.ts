// src/modules/auth/tokens.ts
// Tokens tipados para injecao de dependencia (tsyringe)

export const AUTH_TOKENS = {
  // Repositories
  UserRepository: Symbol.for("UserRepository"),
  RefreshTokenRepository: Symbol.for("RefreshTokenRepository"),
  PermissionRepository: Symbol.for("PermissionRepository"),
  TokenBlacklistRepository: Symbol.for("TokenBlacklistRepository"),
  LoginAttemptsRepository: Symbol.for("LoginAttemptsRepository"),
  AuditLogRepository: Symbol.for("AuditLogRepository"),

  // Services
  TokenService: Symbol.for("TokenService"),
  PasswordService: Symbol.for("PasswordService"),
  ITransactionManager: Symbol.for("ITransactionManager"),
} as const;
