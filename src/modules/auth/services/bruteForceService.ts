// src/modules/auth/services/bruteForceService.ts
// Servico responsavel por protecao contra forca bruta

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../tokens";
import { env } from "../../../config/env";
import { UserRepository } from "../repositories/userRepository";
import { LoginAttemptsRepository } from "../repositories/loginAttemptsRepository";
import { AuditService } from "./auditService";
import { User, RequestContext } from "../../../types";
import { AccountLockedError } from "../domain/errors/AuthErrors";

@injectable()
export class BruteForceService {
  constructor(
    @inject(AUTH_TOKENS.UserRepository) private userRepository: UserRepository,
    @inject(AUTH_TOKENS.LoginAttemptsRepository) private loginAttemptsRepository: LoginAttemptsRepository,
    @inject(AuditService) private auditService: AuditService
  ) {}

  async recordLoginAttempt(
    email: string,
    context: RequestContext,
    success: boolean
  ): Promise<void> {
    await this.loginAttemptsRepository.record({
      email,
      ipAddress: context.ipAddress || "0.0.0.0",
      success,
      userAgent: context.userAgent,
    });
  }

  async checkAndPrepareLoginState(
    user: User,
    email: string,
    context: RequestContext
  ): Promise<void> {
    const isLocked = await this.userRepository.isAccountLocked(user.id);
    if (isLocked) {
      await this.recordLoginAttempt(email, context, false);
      await this.auditService.logBruteForceBlock(email, context);
      throw new AccountLockedError();
    }
  }

  async registerFailedLogin(
    user: Pick<User, "id">,
    email: string,
    context: RequestContext
  ): Promise<void> {
    const result = await this.userRepository.registerFailedLoginAttempt(
      user.id,
      env.MAX_LOGIN_ATTEMPTS,
      env.LOGIN_ATTEMPT_WINDOW_MINUTES,
      env.ACCOUNT_LOCK_DURATION_MINUTES
    );

    if (result.locked) {
      await this.auditService.logBruteForceBlock(email, context);
    }
  }

  async resetOnSuccess(user: Pick<User, "id" | "failed_login_attempts" | "locked_until" | "last_failed_login_at">): Promise<void> {
    const hasLockState = Boolean(
      user.failed_login_attempts || user.locked_until || user.last_failed_login_at
    );
    if (hasLockState) {
      await this.userRepository.resetLoginLock(user.id);
    }
  }
}
