// src/modules/auth/useCases/login/LoginUseCase.ts
// Caso de uso: Autenticacao de usuario

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { LoginInput, LoginContext, LoginOutput } from "./LoginDTO";
import { UserRepository } from "../../repositories/userRepository";
import { RefreshTokenRepository } from "../../repositories/refreshTokenRepository";
import { TokenService } from "../../services/tokenService";
import { PasswordService } from "../../services/passwordService";
import { BruteForceService } from "../../services/bruteForceService";
import { AuditService } from "../../services/auditService";
import { PermissionRepository } from "../../../permissions/repositories/permissionRepository";
import { generateJti, generateFamilyId, hashToken } from "../../../../utils/tokenUtils";
import {
  InvalidCredentialsError,
  InactiveUserError,
} from "../../domain/errors/AuthErrors";

@injectable()
export class LoginUseCase {
  constructor(
    @inject(AUTH_TOKENS.UserRepository) private userRepository: UserRepository,
    @inject(AUTH_TOKENS.RefreshTokenRepository) private refreshTokenRepository: RefreshTokenRepository,
    @inject(AUTH_TOKENS.TokenService) private tokenService: TokenService,
    @inject(AUTH_TOKENS.PasswordService) private passwordService: PasswordService,
    @inject(BruteForceService) private bruteForceService: BruteForceService,
    @inject(AuditService) private auditService: AuditService,
    @inject(AUTH_TOKENS.PermissionRepository) private permissionRepository: PermissionRepository
  ) {}

  async execute(input: LoginInput, context: LoginContext): Promise<LoginOutput> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Buscar usuario
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      return this.handleFailedLogin(undefined, normalizedEmail, context);
    }

    // 2. Verificar brute force e preparar estado
    await this.bruteForceService.checkAndPrepareLoginState(
      user,
      normalizedEmail,
      context
    );

    // 3. Verificar status do usuario
    if (user.status !== "ACTIVE") {
      return this.handleFailedLogin(user, normalizedEmail, context, "inactive");
    }

    // 4. Verificar senha
    if (!user.password_hash) {
      return this.handleFailedLogin(user, normalizedEmail, context);
    }

    const isPasswordValid = await this.passwordService.compare(
      input.password,
      user.password_hash
    );

    if (!isPasswordValid) {
      return this.handleFailedLogin(user, normalizedEmail, context, "invalid_password");
    }

    // 5. Gerar tokens
    const permissions = await this.permissionRepository.findCodesByRoleCode(user.role);
    const accessJti = generateJti();
    const accessToken = this.tokenService.generateAccessToken(user, accessJti, permissions);
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshJti = generateJti();
    const familyId = generateFamilyId();

    // 6. Salvar refresh token
    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      jti: refreshJti,
      familyId,
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });

    // 7. Resetar contadores de falha e registrar sucesso
    await this.bruteForceService.resetOnSuccess(user);
    await this.bruteForceService.recordLoginAttempt(normalizedEmail, context, true);
    await this.auditService.logLogin(user.id, normalizedEmail, "success", context);

    // 8. Retornar resposta
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions,
      },
      accessToken,
      refreshToken,
      expiresIn: this.tokenService.getAccessTokenExpiration(),
    };
  }

  private async handleFailedLogin(
    user: { id: string; email: string } | undefined,
    email: string,
    context: LoginContext,
    reason?: "inactive" | "invalid_password"
  ): Promise<never> {
    await this.bruteForceService.recordLoginAttempt(email, context, false);
    await this.auditService.logLogin(
      user?.id,
      email,
      "failure",
      context,
      reason ? { reason } : undefined
    );

    if (reason === "inactive") {
      if (user) {
        await this.bruteForceService.registerFailedLogin(
          user,
          email,
          context
        );
      }
      throw new InactiveUserError();
    }

    if (user) {
      await this.bruteForceService.registerFailedLogin(
        user,
        email,
        context
      );
    }

    throw new InvalidCredentialsError();
  }
}
