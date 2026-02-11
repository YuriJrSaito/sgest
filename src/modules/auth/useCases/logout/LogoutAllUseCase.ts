// src/modules/auth/useCases/logout/LogoutAllUseCase.ts
// Caso de uso: Logout de todos os dispositivos

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { LogoutAllInput, LogoutContext } from "./LogoutDTO";
import { RefreshTokenRepository } from "../../repositories/refreshTokenRepository";
import { TokenBlacklistRepository } from "../../repositories/tokenBlacklistRepository";
import { TokenService } from "../../services/tokenService";
import { AuditService } from "../../services/auditService";
import { ITransactionManager } from "../../services/interfaces/ITransactionManager";
import { hashToken } from "../../../../utils/tokenUtils";

@injectable()
export class LogoutAllUseCase {
  constructor(
    @inject(AUTH_TOKENS.RefreshTokenRepository) private refreshTokenRepository: RefreshTokenRepository,
    @inject(AUTH_TOKENS.TokenService) private tokenService: TokenService,
    @inject(AUTH_TOKENS.TokenBlacklistRepository) private tokenBlacklistRepository: TokenBlacklistRepository,
    @inject(AuditService) private auditService: AuditService,
    @inject(AUTH_TOKENS.ITransactionManager) private transactionManager: ITransactionManager
  ) {}

  async execute(input: LogoutAllInput, context: LogoutContext): Promise<void> {
    const decoded = this.tokenService.verifyToken(input.accessToken);

    const expiresAt = new Date(decoded.exp! * 1000);

    // all-or-nothing: blacklist + revogacao de sessoes na mesma transacao.
    await this.transactionManager.transaction(async (ctx) => {
      await this.tokenBlacklistRepository.add(
        {
          jti: decoded.jti,
          userId: input.userId,
          tokenHash: hashToken(input.accessToken),
          reason: "logout_all",
          expiresAt,
        },
        ctx
      );

      await this.refreshTokenRepository.revokeAllByUserId(input.userId, ctx);
    });

    await this.auditService.logLogout(input.userId, context, true);
  }
}
