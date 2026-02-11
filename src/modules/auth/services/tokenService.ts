// src/modules/auth/services/tokenService.ts
// Servico responsavel por geracao e validacao de tokens JWT

import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../../../config/env";
import { JWTPayload, User, PermissionCode } from "../../../types";
import { InvalidTokenError, TokenExpiredError } from "../domain/errors/AuthErrors";

export class TokenService {
  /**
   * Gera um access token JWT com JTI
   */
  generateAccessToken(
    user: Pick<User, "id" | "email" | "role">,
    jti: string,
    permissions: PermissionCode[] = []
  ): string {
    const payload: JWTPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions,
      jti,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as SignOptions);
  }

  /**
   * Gera um refresh token aleatorio seguro (40 bytes hex)
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  /**
   * Verifica e decodifica access token JWT
   * @throws InvalidTokenError se o token for invalido
   * @throws TokenExpiredError se o token estiver expirado
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      return decoded as JWTPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  /**
   * Decodifica token sem verificar assinatura (para debug/logs)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload | null;
    } catch {
      return null;
    }
  }

  /**
   * Retorna o tempo de expiracao configurado para access tokens
   */
  getAccessTokenExpiration(): string {
    return env.JWT_EXPIRES_IN;
  }

  /**
   * Retorna o tempo de expiracao configurado para refresh tokens
   */
  getRefreshTokenExpiration(): string {
    return env.JWT_REFRESH_EXPIRES_IN;
  }

  /**
   * Converte string de expiracao (ex: "30d", "7d", "24h") para Date
   */
  parseExpirationDate(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([dhms])$/);

    if (!match) {
      // Fallback para 30 dias se formato invalido
      now.setDate(now.getDate() + 30);
      return now;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "d":
        now.setDate(now.getDate() + value);
        break;
      case "h":
        now.setHours(now.getHours() + value);
        break;
      case "m":
        now.setMinutes(now.getMinutes() + value);
        break;
      case "s":
        now.setSeconds(now.getSeconds() + value);
        break;
    }

    return now;
  }

  /**
   * Calcula a data de expiracao do refresh token
   */
  getRefreshTokenExpiresAt(): Date {
    return this.parseExpirationDate(env.JWT_REFRESH_EXPIRES_IN);
  }
}

const tokenService = new TokenService();

export default tokenService;
