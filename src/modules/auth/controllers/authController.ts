// src/modules/auth/controllers/authController.ts
import { injectable, inject } from "tsyringe";
import { FastifyRequest, FastifyReply } from 'fastify';
import { LoginUseCase } from "../useCases/login/LoginUseCase";
import { RefreshTokenUseCase } from "../useCases/refreshToken/RefreshTokenUseCase";
import { LogoutUseCase } from "../useCases/logout/LogoutUseCase";
import { LogoutAllUseCase } from "../useCases/logout/LogoutAllUseCase";
import { ChangePasswordUseCase } from "../useCases/changePassword/ChangePasswordUseCase";
import { GetProfileUseCase } from "../useCases/profile/GetProfileUseCase";
import { UpdateProfileUseCase } from "../useCases/profile/UpdateProfileUseCase";
import { GetSessionsUseCase } from "../useCases/sessions/GetSessionsUseCase";
import { RevokeSessionUseCase } from "../useCases/sessions/RevokeSessionUseCase";
import { LoginDTO, UpdateUserDTO, ChangePasswordRequestDTO } from '../../../types';
import { AuthenticationError } from '../domain/errors/DomainErrors';
import { getRequestContext } from '../../../utils/requestUtils';
import { setRefreshTokenCookie, clearRefreshTokenCookie, getRefreshTokenCookieName } from '../../../utils/cookieUtils';

function requireUser(request: FastifyRequest) {
  const user = request.user;
  if (!user) {
    throw new AuthenticationError('Usuario nao autenticado');
  }
  return user;
}

function getAuthToken(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization;
  return authHeader?.split(' ')[1];
}

@injectable()
export class AuthController {
  constructor(
    @inject(LoginUseCase) private loginUseCase: LoginUseCase,
    @inject(RefreshTokenUseCase) private refreshTokenUseCase: RefreshTokenUseCase,
    @inject(LogoutUseCase) private logoutUseCase: LogoutUseCase,
    @inject(LogoutAllUseCase) private logoutAllUseCase: LogoutAllUseCase,
    @inject(ChangePasswordUseCase) private changePasswordUseCase: ChangePasswordUseCase,
    @inject(GetProfileUseCase) private getProfileUseCase: GetProfileUseCase,
    @inject(UpdateProfileUseCase) private updateProfileUseCase: UpdateProfileUseCase,
    @inject(GetSessionsUseCase) private getSessionsUseCase: GetSessionsUseCase,
    @inject(RevokeSessionUseCase) private revokeSessionUseCase: RevokeSessionUseCase
  ) {}

  async login(
    request: FastifyRequest<{ Body: LoginDTO }>,
    reply: FastifyReply
  ) {
    const { email, password } = request.body;
    const context = getRequestContext(request);

    const result = await this.loginUseCase.execute({ email, password }, context);

    setRefreshTokenCookie(reply, result.refreshToken);

    const responseData = {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };

    return reply.code(200).send({
      status: 'success',
      message: 'Login realizado com sucesso',
      data: responseData,
    });
  }

  async getProfile(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;

    const user = await this.getProfileUseCase.execute({ userId });

    return reply.code(200).send({
      status: 'success',
      data: { user },
    });
  }

  async updateProfile(
    request: FastifyRequest<{ Body: UpdateUserDTO }>,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;
    const { name, email } = request.body;

    const user = await this.updateProfileUseCase.execute({ userId, name, email });

    return reply.code(200).send({
      status: 'success',
      message: 'Perfil atualizado com sucesso',
      data: { user },
    });
  }

  async changePassword(
    request: FastifyRequest<{ Body: ChangePasswordRequestDTO }>,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;
    const { currentPassword, newPassword } = request.body;
    const context = getRequestContext(request);
    const accessToken = getAuthToken(request);

    await this.changePasswordUseCase.execute(
      { userId, currentPassword, newPassword, accessToken },
      context
    );

    return reply.code(200).send({
      status: 'success',
      message: 'Senha alterada com sucesso',
      data: { message: 'Senha alterada com sucesso' },
    });
  }

  async refreshToken(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const refreshToken = request.cookies[getRefreshTokenCookieName()];

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token nao fornecido');
    }

    const context = getRequestContext(request);

    const result = await this.refreshTokenUseCase.execute({ refreshToken }, context);

    setRefreshTokenCookie(reply, result.refreshToken);

    const responseData = {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };

    return reply.code(200).send({
      status: 'success',
      message: 'Token renovado com sucesso',
      data: responseData,
    });
  }

  async logout(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;
    const accessToken = getAuthToken(request);

    if (!accessToken) {
      throw new AuthenticationError('Token nao fornecido');
    }

    const refreshToken = request.cookies[getRefreshTokenCookieName()];
    const context = getRequestContext(request);

    await this.logoutUseCase.execute({ userId, accessToken, refreshToken }, context);

    clearRefreshTokenCookie(reply);

    return reply.code(200).send({
      status: 'success',
      message: 'Logout realizado com sucesso',
      data: { message: 'Logout realizado com sucesso' },
    });
  }

  async logoutAll(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;
    const accessToken = getAuthToken(request);

    if (!accessToken) {
      throw new AuthenticationError('Token nao fornecido');
    }

    const context = getRequestContext(request);

    await this.logoutAllUseCase.execute({ userId, accessToken }, context);

    clearRefreshTokenCookie(reply);

    return reply.code(200).send({
      status: 'success',
      message: 'Logout realizado em todos os dispositivos com sucesso',
      data: { message: 'Logout realizado em todos os dispositivos com sucesso' },
    });
  }

  async getSessions(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;
    const currentRefreshToken = request.cookies[getRefreshTokenCookieName()];

    const sessions = await this.getSessionsUseCase.execute({ userId, currentRefreshToken });

    return reply.code(200).send({
      status: 'success',
      data: { sessions },
    });
  }

  async revokeSession(
    request: FastifyRequest<{ Params: { sessionId: string } }>,
    reply: FastifyReply
  ) {
    const { sessionId } = request.params;
    const context = getRequestContext(request);
    const userId = requireUser(request).id;

    await this.revokeSessionUseCase.execute({ userId, sessionId }, context);

    return reply.code(200).send({
      status: 'success',
      message: 'Sessao encerrada com sucesso',
      data: { message: 'Sessao encerrada com sucesso' },
    });
  }
}
