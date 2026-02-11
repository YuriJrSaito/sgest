// src/utils/cookieUtils.ts
import { FastifyReply } from "fastify";
import { env } from "../config/env";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

// Calcula maxAge em segundos baseado na string de expiração (ex: "30d")
function parseMaxAge(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([dhms])$/);

  if (!match) {
    // Fallback para 30 dias
    return 30 * 24 * 60 * 60;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "d":
      return value * 24 * 60 * 60;
    case "h":
      return value * 60 * 60;
    case "m":
      return value * 60;
    case "s":
      return value;
    default:
      return 30 * 24 * 60 * 60;
  }
}

/**
 * Define o refresh token como cookie HttpOnly seguro
 */
export function setRefreshTokenCookie(
  reply: FastifyReply,
  refreshToken: string
): void {
  const isProduction = env.NODE_ENV === "production";
  const maxAge = parseMaxAge(env.JWT_REFRESH_EXPIRES_IN);

  reply.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true, // JavaScript não pode acessar
    secure: isProduction, // Só HTTPS em produção
    sameSite: "lax", // Lax permite navegação normal e refresh via same-site requests
    path: "/", // Permite envio tambem para /api/proxy
    maxAge, // Tempo de vida do cookie
  });
}

/**
 * Remove o cookie de refresh token (usado no logout)
 */
export function clearRefreshTokenCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    path: "/",
  });
}

/**
 * Obtém o nome do cookie de refresh token
 */
export function getRefreshTokenCookieName(): string {
  return REFRESH_TOKEN_COOKIE_NAME;
}
