// src/modules/auth/routes.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container } from 'tsyringe';
import './container';
import { authenticate } from '../../middlewares/authMiddleware';
import { AuthController } from './controllers/authController';
import { AuditController } from './controllers/auditController';
import {
  loginSchema,
  profileSchema,
  updateProfileSchema,
  changePasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  sessionsSchema,
  revokeSessionSchema,
  loginHistorySchema,
  auditHistorySchema,
  auditStatsSchema,
} from './schemas';
import { ChangePasswordRequestDTO, UpdateUserDTO } from '../../types';

type RouteHandler<TRequest extends FastifyRequest = FastifyRequest> = (
  request: TRequest,
  reply: FastifyReply
) => Promise<unknown> | unknown;

function bindHandler<TController extends object, TRequest extends FastifyRequest = FastifyRequest>(
  controller: TController,
  handler: (this: TController, request: TRequest, reply: FastifyReply) => Promise<unknown> | unknown
): RouteHandler<TRequest> {
  return handler.bind(controller);
}

export default async function authRoutes(fastify: FastifyInstance) {
  const authController = container.resolve(AuthController);
  const auditController = container.resolve(AuditController);

  const handlers = {
    login: bindHandler(authController, authController.login),
    getProfile: bindHandler(authController, authController.getProfile),
    updateProfile: bindHandler(authController, authController.updateProfile),
    changePassword: bindHandler(authController, authController.changePassword),
    refreshToken: bindHandler(authController, authController.refreshToken),
    logout: bindHandler(authController, authController.logout),
    logoutAll: bindHandler(authController, authController.logoutAll),
    getSessions: bindHandler(authController, authController.getSessions),
    revokeSession: bindHandler(authController, authController.revokeSession),
    getLoginHistory: bindHandler(auditController, auditController.getLoginHistory),
    getAuditHistory: bindHandler(auditController, auditController.getAuditHistory),
    getStats: bindHandler(auditController, auditController.getStats),
  };

  // Rotas publicas
  fastify.post(
    '/login',
    { schema: loginSchema },
    handlers.login
  );

  // Rotas protegidas (requerem autenticacao)
  fastify.get(
    '/profile',
    {
      schema: profileSchema,
      preHandler: authenticate
    },
    handlers.getProfile
  );

  fastify.put<{Body: UpdateUserDTO}>(
    '/profile',
    {
      schema: updateProfileSchema,
      preHandler: authenticate
    },
    handlers.updateProfile
  );

  fastify.post<{Body: ChangePasswordRequestDTO}>(
    "/change-password",
    {
      schema: changePasswordSchema,
      preHandler: authenticate,
    },
    handlers.changePassword
  );

  // Refresh token (rota publica - le refresh token do cookie HttpOnly)
  fastify.post(
    '/refresh',
    { schema: refreshTokenSchema },
    handlers.refreshToken
  );

  // Logout (revoga tokens do dispositivo atual)
  fastify.post(
    '/logout',
    {
      schema: logoutSchema,
      preHandler: authenticate
    },
    handlers.logout
  );

  // Logout de todos os dispositivos
  fastify.post(
    '/logout-all',
    {
      schema: logoutSchema,
      preHandler: authenticate
    },
    handlers.logoutAll
  );

  // Sessoes ativas do usuario
  fastify.get(
    '/sessions',
    {
      schema: sessionsSchema,
      preHandler: authenticate
    },
    handlers.getSessions
  );

  // Revogar sessao especifica
  fastify.delete<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId',
    {
      schema: revokeSessionSchema,
      preHandler: authenticate
    },
    handlers.revokeSession
  );

  // Audit routes (protegidas)
  fastify.get<{ Querystring: { page?: number; limit?: number } }>(
    '/audit/login-history',
    {
      schema: loginHistorySchema,
      preHandler: authenticate
    },
    handlers.getLoginHistory
  );

  fastify.get<{ Querystring: { page?: number; limit?: number } }>(
    '/audit/history',
    {
      schema: auditHistorySchema,
      preHandler: authenticate
    },
    handlers.getAuditHistory
  );

  fastify.get(
    '/audit/stats',
    {
      schema: auditStatsSchema,
      preHandler: authenticate
    },
    handlers.getStats
  );
}
