// src/modules/auth/useCases/sessions/RevokeSessionUseCase.ts
// Caso de uso: Revogar uma sessao especifica

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { RevokeSessionInput, RevokeSessionContext } from "./SessionsDTO";
import { RefreshTokenRepository } from "../../repositories/refreshTokenRepository";
import { AuditService } from "../../services/auditService";
import { ITransactionManager } from "../../services/interfaces/ITransactionManager";
import { SessionNotFoundError } from "../../domain/errors/AuthErrors";

@injectable()
export class RevokeSessionUseCase {
  constructor(
    @inject(AUTH_TOKENS.RefreshTokenRepository) private refreshTokenRepository: RefreshTokenRepository,
    @inject(AuditService) private auditService: AuditService,
    @inject(AUTH_TOKENS.ITransactionManager) private transactionManager: ITransactionManager
  ) {}

  async execute(input: RevokeSessionInput, context: RevokeSessionContext): Promise<void> {
    // 1. Buscar sessoes ativas do usuario
    const tokens = await this.refreshTokenRepository.findActiveByUserId(input.userId);
    const session = tokens.find((t) => t.id === input.sessionId);

    if (!session) {
      throw new SessionNotFoundError();
    }

    // 2. Revogar a sessao em transacao atomica
    await this.transactionManager.transaction(async (ctx) => {
      await this.refreshTokenRepository.revokeByJti(session.jti, undefined, ctx);
    });

    // 3. Audit log
    await this.auditService.log({
      userId: input.userId,
      action: "session_revoked",
      resourceType: "auth",
      resourceId: input.sessionId,
      status: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}
