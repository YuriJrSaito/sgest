// src/modules/auth/useCases/logout/LogoutUseCase.ts
// Caso de uso: Logout do dispositivo atual

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { LogoutInput, LogoutContext } from "./LogoutDTO";
import { RefreshTokenRepository } from "../../repositories/refreshTokenRepository";
import { TokenBlacklistRepository } from "../../repositories/tokenBlacklistRepository";
import { TokenService } from "../../services/tokenService";
import { AuditService } from "../../services/auditService";
import { ITransactionManager } from "../../services/interfaces/ITransactionManager";
import { hashToken } from "../../../../utils/tokenUtils";

@injectable()
export class LogoutUseCase {
  constructor(
    @inject(AUTH_TOKENS.RefreshTokenRepository) private refreshTokenRepository: RefreshTokenRepository,
    @inject(AUTH_TOKENS.TokenService) private tokenService: TokenService,
    @inject(AUTH_TOKENS.TokenBlacklistRepository) private tokenBlacklistRepository: TokenBlacklistRepository,
    @inject(AuditService) private auditService: AuditService,
    @inject(AUTH_TOKENS.ITransactionManager) private transactionManager: ITransactionManager
  ) {}

  async execute(input: LogoutInput, context: LogoutContext): Promise<void> {
    const decoded = this.tokenService.verifyToken(input.accessToken);

    const expiresAt = new Date(decoded.exp! * 1000);

    // Persistencia de revogacao em transacao unica para evitar estado parcial.
    await this.transactionManager.transaction(async (ctx) => {
      await this.tokenBlacklistRepository.add(
        {
          jti: decoded.jti,
          userId: input.userId,
          tokenHash: hashToken(input.accessToken),
          reason: "logout",
          expiresAt,
        },
        ctx
      );

      if (input.refreshToken) {
        const storedToken = await this.refreshTokenRepository.findByTokenHash(
          hashToken(input.refreshToken),
          ctx
        );
        if (storedToken && storedToken.user_id === input.userId) {
          await this.refreshTokenRepository.revokeByJti(storedToken.jti, undefined, ctx);
        }
      }
    });

    await this.auditService.logLogout(input.userId, context, false);
  }
}
