// src/modules/auth/useCases/changePassword/ChangePasswordUseCase.ts
// Caso de uso: Alterar senha do usuario

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { ChangePasswordInput, ChangePasswordContext } from "./ChangePasswordDTO";
import { UserRepository } from "../../repositories/userRepository";
import { RefreshTokenRepository } from "../../repositories/refreshTokenRepository";
import { TokenBlacklistRepository } from "../../repositories/tokenBlacklistRepository";
import { PasswordService } from "../../services/passwordService";
import { TokenService } from "../../services/tokenService";
import { AuditService } from "../../services/auditService";
import { ITransactionManager } from "../../services/interfaces/ITransactionManager";
import { hashToken } from "../../../../utils/tokenUtils";
import { InvalidCurrentPasswordError } from "../../domain/errors/AuthErrors";
import { ResourceNotFoundError } from "../../domain/errors/DomainErrors";

@injectable()
export class ChangePasswordUseCase {
  constructor(
    @inject(AUTH_TOKENS.UserRepository) private userRepository: UserRepository,
    @inject(AUTH_TOKENS.RefreshTokenRepository) private refreshTokenRepository: RefreshTokenRepository,
    @inject(AUTH_TOKENS.PasswordService) private passwordService: PasswordService,
    @inject(AUTH_TOKENS.TokenService) private tokenService: TokenService,
    @inject(AUTH_TOKENS.TokenBlacklistRepository) private tokenBlacklistRepository: TokenBlacklistRepository,
    @inject(AuditService) private auditService: AuditService,
    @inject(AUTH_TOKENS.ITransactionManager) private transactionManager: ITransactionManager
  ) {}

  async execute(input: ChangePasswordInput, context: ChangePasswordContext): Promise<void> {
    // 1. Buscar usuario
    const user = await this.userRepository.findById(input.userId);
    const userWithPassword = await this.userRepository.findByEmail(user.email);

    if (!userWithPassword || !userWithPassword.password_hash) {
      throw new ResourceNotFoundError("Usuario nao encontrado");
    }

    // 2. Verificar senha atual
    const isPasswordValid = await this.passwordService.compare(
      input.currentPassword,
      userWithPassword.password_hash
    );

    if (!isPasswordValid) {
      throw new InvalidCurrentPasswordError();
    }

    // 3. Hash da nova senha
    const newPasswordHash = await this.passwordService.hash(input.newPassword);

    // 4. Preparar invalidacao do access token atual (se fornecido)
    let accessTokenPayload:
      | { jti: string; tokenHash: string; expiresAt: Date }
      | undefined;
    if (input.accessToken) {
      const decoded = this.tokenService.verifyToken(input.accessToken);
      accessTokenPayload = {
        jti: decoded.jti,
        tokenHash: hashToken(input.accessToken),
        expiresAt: new Date(decoded.exp! * 1000),
      };
    }

    // 5. Atualizar credenciais e revogar sessoes de forma atomica.
    await this.transactionManager.transaction(async (ctx) => {
      await this.userRepository.updatePassword(input.userId, newPasswordHash, ctx);
      await this.refreshTokenRepository.revokeAllByUserId(input.userId, ctx);

      if (accessTokenPayload) {
        await this.tokenBlacklistRepository.add(
          {
            jti: accessTokenPayload.jti,
            userId: input.userId,
            tokenHash: accessTokenPayload.tokenHash,
            reason: "password_change",
            expiresAt: accessTokenPayload.expiresAt,
          },
          ctx
        );
      }
    });

    // 6. Audit log
    await this.auditService.logPasswordChange(input.userId, context);
  }
}
