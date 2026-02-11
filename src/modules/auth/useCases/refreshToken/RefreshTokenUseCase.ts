// src/modules/auth/useCases/refreshToken/RefreshTokenUseCase.ts
// Caso de uso: Renovar tokens com rotation

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { RefreshTokenInput, RefreshTokenContext, RefreshTokenOutput } from "./RefreshTokenDTO";
import { UserRepository } from "../../repositories/userRepository";
import { RefreshTokenRepository } from "../../repositories/refreshTokenRepository";
import { TokenService } from "../../services/tokenService";
import { AuditService } from "../../services/auditService";
import { ITransactionManager } from "../../services/interfaces/ITransactionManager";
import { TransactionContext } from "../../types";
import { PermissionRepository } from "../../../permissions/repositories/permissionRepository";
import { hashToken, generateJti } from "../../../../utils/tokenUtils";
import {
  InvalidTokenError,
  TokenExpiredError,
  TokenRevokedError,
  InactiveUserError,
} from "../../domain/errors/AuthErrors";

const REFRESH_LOCK_TIMEOUT_MS = Number(process.env.REFRESH_LOCK_TIMEOUT_MS) || 2000;

const refreshInFlight = new Map<string, Promise<RefreshTokenOutput>>();

@injectable()
export class RefreshTokenUseCase {
  constructor(
    @inject(AUTH_TOKENS.UserRepository) private userRepository: UserRepository,
    @inject(AUTH_TOKENS.RefreshTokenRepository) private refreshTokenRepository: RefreshTokenRepository,
    @inject(AUTH_TOKENS.TokenService) private tokenService: TokenService,
    @inject(AuditService) private auditService: AuditService,
    @inject(AUTH_TOKENS.PermissionRepository) private permissionRepository: PermissionRepository,
    @inject(AUTH_TOKENS.ITransactionManager) private transactionManager: ITransactionManager
  ) {}

  async execute(input: RefreshTokenInput, context: RefreshTokenContext): Promise<RefreshTokenOutput> {
    const existing = refreshInFlight.get(input.refreshToken);
    if (existing) return existing;

    const promise = this.executeRotation(input, context)
      .finally(() => refreshInFlight.delete(input.refreshToken));
    refreshInFlight.set(input.refreshToken, promise);
    return promise;
  }

  private async executeRotation(input: RefreshTokenInput, context: RefreshTokenContext): Promise<RefreshTokenOutput> {
    const tokenHash = hashToken(input.refreshToken);

    const rotationResult = await this.transactionManager.transaction(async (ctx) => {
      // 1. Buscar token com lock para evitar race condition
      const storedToken = await this.refreshTokenRepository.findByTokenHashWithLock(
        tokenHash,
        REFRESH_LOCK_TIMEOUT_MS,
        ctx
      );

      if (!storedToken) {
        await this.auditService.logTokenRefresh(undefined, context, false);
        throw new InvalidTokenError("Refresh token invalido");
      }

      // 2. Verificar se token foi revogado (detectar reuso)
      if (storedToken.revoked) {
        await this.handleTokenReuse(storedToken, context, ctx);
      }

      // 3. Verificar expiracao
      if (new Date() > new Date(storedToken.expires_at)) {
        await this.auditService.logTokenRefresh(storedToken.user_id, context, false);
        throw new TokenExpiredError("Refresh token expirado");
      }

      // 4. Buscar usuario e verificar status
      // Token apontando para usuario inexistente deve ser tratado como token invalido (401),
      // nao como recurso nao encontrado (404), para manter contrato de auth consistente.
      const user = await this.userRepository.findByIdOrNull(storedToken.user_id);
      if (!user) {
        await this.auditService.logTokenRefresh(storedToken.user_id, context, false);
        throw new InvalidTokenError("Refresh token invalido");
      }

      if (user.status !== "ACTIVE") {
        await this.auditService.logTokenRefresh(user.id, context, false);
        throw new InactiveUserError();
      }

      // 5. Gerar novos tokens
      const permissions = await this.permissionRepository.findCodesByRoleCode(user.role);
      const accessJti = generateJti();
      const accessToken = this.tokenService.generateAccessToken(user, accessJti, permissions);
      const newRefreshToken = this.tokenService.generateRefreshToken();
      const newRefreshJti = generateJti();

      // 6. Revogar token antigo (token rotation)
      await this.refreshTokenRepository.revokeByJti(
        storedToken.jti,
        newRefreshJti,
        ctx
      );

      // 7. Criar novo refresh token
      await this.refreshTokenRepository.create(
        {
          userId: user.id,
          tokenHash: hashToken(newRefreshToken),
          jti: newRefreshJti,
          familyId: storedToken.family_id,
          expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
        },
        ctx
      );

      return {
        userId: user.id,
        output: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: this.tokenService.getAccessTokenExpiration(),
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            permissions,
          },
        },
      };
    });

    // Log de sucesso apenas apos commit efetivo da transacao.
    await this.auditService.logTokenRefresh(rotationResult.userId, context, true);

    return rotationResult.output;
  }

  private async handleTokenReuse(
    storedToken: { family_id: string; user_id: string; replaced_by_jti?: string },
    context: RefreshTokenContext,
    ctx: TransactionContext
  ): Promise<never> {
    if (storedToken.replaced_by_jti) {
      // Token ja foi usado - revogar toda a familia por seguranca
      await this.refreshTokenRepository.revokeFamilyChain(storedToken.family_id, ctx);
      await this.auditService.logTokenReuseDetected(storedToken.user_id, context);
    }
    throw new TokenRevokedError("Refresh token revogado. Todas as sessoes foram encerradas por seguranca.");
  }
}
