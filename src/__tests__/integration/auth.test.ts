// src/__tests__/integration/auth.test.ts
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import authRoutes from '../../modules/auth/routes';
import { errorHandler } from '../../utils/errors';
import { cleanDatabase, createTestUser, generateToken } from '../helpers/testHelpers';
import database from '../../config/database';
import { env } from '../../config/env';

describe('Auth Integration Tests', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(cookie, { secret: env.JWT_SECRET });
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/auth/login', () => {
    it('deve fazer login com sucesso', async () => {
      await createTestUser({
        email: 'joao@email.com',
        password: 'senha123',
        role: 'RESELLER',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'joao@email.com',
          password: 'senha123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'success',
        data: {
          user: {
            email: 'joao@email.com',
            role: 'RESELLER',
            status: 'ACTIVE',
          },
          accessToken: expect.any(String),
          expiresIn: expect.any(String),
        },
      });
    });

    it('deve retornar erro com credenciais invÃ¡lidas', async () => {
      await createTestUser({
        email: 'joao@email.com',
        password: 'senha123',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'joao@email.com',
          password: 'senhaErrada',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        status: 'error',
        message: 'Email ou senha invalidos',
      });
    });

    it('deve retornar erro se usuÃ¡rio nÃ£o existir', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'naoexiste@email.com',
          password: 'senha123',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('deve retornar erro se usuÃ¡rio estiver inativo', async () => {
      await createTestUser({
        email: 'inativo@email.com',
        password: 'senha123',
        status: 'INACTIVE',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'inativo@email.com',
          password: 'senha123',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        status: 'error',
        message: 'Usuario inativo',
      });
    });

    it('deve bloquear conta apos tentativas concorrentes invalidas', async () => {
      await createTestUser({
        email: 'lock@email.com',
        password: 'senha123',
      });

      const attempts = Array.from({ length: env.MAX_LOGIN_ATTEMPTS + 1 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: 'lock@email.com',
            password: 'senhaErrada',
          },
        })
      );

      await Promise.all(attempts);

      const blockedResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'lock@email.com',
          password: 'senha123',
        },
      });

      expect(blockedResponse.statusCode).toBe(429);

      const lockState = await database.query<{ locked_until: Date | null }>(
        'SELECT locked_until FROM users WHERE email = $1',
        ['lock@email.com']
      );
      expect(lockState.rows[0]?.locked_until).not.toBeNull();
    });
  });

  describe('GET /api/auth/profile', () => {
    it('deve retornar perfil do usuÃ¡rio autenticado', async () => {
      const user = await createTestUser();
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/profile',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'success',
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: 'RESELLER',
            status: 'ACTIVE',
            created_at: expect.any(String),
            updated_at: expect.any(String),
          },
        },
      });
    });

    it('deve retornar erro sem token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/profile',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ status: 'error' });
      expect(response.json().message).toMatch(/Token.*fornecido/i);
    });

    it('deve retornar erro com token invÃ¡lido', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/profile',
        headers: {
          authorization: 'Bearer tokeninvalido',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('deve atualizar perfil com sucesso', async () => {
      const user = await createTestUser();
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/auth/profile',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Nome Atualizado',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'success',
        data: {
          user: {
            name: 'Nome Atualizado',
          },
        },
      });
    });

    it('deve rejeitar payload vazio', async () => {
      const user = await createTestUser();
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/auth/profile',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        status: 'error',
      });
    });

    it('deve retornar erro se tentar atualizar com email jÃ¡ existente', async () => {
      await createTestUser({ email: 'outro@email.com' });
      const user = await createTestUser({ email: 'joao@email.com' });
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/auth/profile',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          email: 'outro@email.com',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('deve alterar senha com sucesso', async () => {
      const user = await createTestUser({ password: 'SenhaAntiga@1' });
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          currentPassword: 'SenhaAntiga@1',
          newPassword: 'SenhaNova@123',
        },
      });

      if (response.statusCode !== 200) {
        throw new Error(`Status ${response.statusCode}: ${JSON.stringify(response.json())}`);
      }
      expect(response.json()).toMatchObject({
        status: 'success',
        message: 'Senha alterada com sucesso',
      });
    });

    it('deve retornar erro com senha atual incorreta', async () => {
      const user = await createTestUser({ password: 'SenhaCorreta@1' });
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          currentPassword: 'SenhaErrada@1',
          newPassword: 'SenhaNova@123',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('deve renovar access token com sucesso via cookie', async () => {
      const user = await createTestUser();

      // Fazer login para obter refresh token no cookie
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: user.email,
          password: 'senha123',
        },
      });

      // Extrair cookies da resposta
      const cookies = loginResponse.cookies;
      const refreshCookie = cookies.find((c: { name: string; value: string }) => c.name === 'refreshToken');

      expect(refreshCookie).toBeDefined();

      // Renovar token usando o cookie
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: {
          refreshToken: refreshCookie!.value,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'success',
        data: {
          accessToken: expect.any(String),
          expiresIn: expect.any(String),
        },
      });
    });

    it('deve retornar erro sem refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('deve fazer logout com sucesso', async () => {
      const user = await createTestUser();
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'success',
        message: 'Logout realizado com sucesso',
      });
    });

    it('deve retornar erro sem autenticaÃ§Ã£o', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('deve fazer logout de todos os dispositivos', async () => {
      const user = await createTestUser();
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout-all',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'success',
        message: 'Logout realizado em todos os dispositivos com sucesso',
      });
    });
  });

  describe('DELETE /api/auth/sessions/:sessionId', () => {
    it('deve revogar sessao com contrato de resposta valido', async () => {
      const user = await createTestUser();

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: user.email,
          password: 'senha123',
        },
      });
      expect(loginResponse.statusCode).toBe(200);

      const loginData = loginResponse.json() as {
        data: { accessToken: string };
      };
      const accessToken = loginData.data.accessToken;

      const sessionsResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/sessions',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      expect(sessionsResponse.statusCode).toBe(200);

      const sessionsData = sessionsResponse.json() as {
        data: { sessions: Array<{ id: string }> };
      };
      const sessionId = sessionsData.data.sessions[0]?.id;
      expect(sessionId).toBeDefined();

      const revokeResponse = await app.inject({
        method: 'DELETE',
        url: `/api/auth/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(revokeResponse.statusCode).toBe(200);
      expect(revokeResponse.json()).toMatchObject({
        status: 'success',
        message: 'Sessao encerrada com sucesso',
        data: {
          message: 'Sessao encerrada com sucesso',
        },
      });
    });
  });

  describe('GET /api/auth/audit/login-history', () => {
    it('deve retornar histÃ³rico de login', async () => {
      const user = await createTestUser();
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/audit/login-history',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'success',
        data: {
          logs: expect.any(Array),
          pagination: {
            total: expect.any(Number),
            page: expect.any(Number),
            limit: expect.any(Number),
            totalPages: expect.any(Number),
          },
        },
      });
    });

    it('deve retornar erro sem autenticaÃ§Ã£o', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/audit/login-history',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/audit/stats', () => {
    it('deve retornar estatÃ­sticas de auditoria', async () => {
      const user = await createTestUser();
      const token = generateToken(user.id, user.email, user.role);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/audit/stats',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'success',
        data: {
          stats: {
            totalLogins: expect.any(Number),
            failedLogins: expect.any(Number),
          },
        },
      });
    });
  });
});
