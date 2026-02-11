import { FastifyRequest } from "fastify";
import tokenService from "../modules/auth/services/tokenService";
import tokenBlacklistRepository from "../modules/auth/repositories/tokenBlacklistRepository";
import { getPermissionsForRole } from "./permissionMiddleware";
import { AppError, UnauthorizedError, ForbiddenError } from "../utils/errors";
import { DomainError } from "../domain/errors/DomainErrors";

function isLikelyJwtValidationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("jwt") ||
    message.includes("token") ||
    message.includes("signature")
  );
}

async function verifyRequestToken(request: FastifyRequest) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError("Token nao fornecido");
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Formato de token invalido");
  }

  const decoded = tokenService.verifyToken(token);

  if (!decoded.jti) {
    throw new UnauthorizedError("Token invalido (sem identificador)");
  }

  const isBlacklisted = await tokenBlacklistRepository.isBlacklisted(decoded.jti);
  if (isBlacklisted) {
    throw new UnauthorizedError("Token revogado");
  }

  const tokenPermissions = Array.isArray(decoded.permissions)
    ? decoded.permissions
    : [];
  const permissions = tokenPermissions.length > 0
    ? tokenPermissions
    : Array.from(await getPermissionsForRole(decoded.role));

  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    permissions,
  };
}

export async function authenticate(request: FastifyRequest) {
  try {
    const user = await verifyRequestToken(request);
    request.user = user;
  } catch (err) {
    if (
      (err instanceof AppError && err.isOperational) ||
      err instanceof DomainError
    ) {
      throw err;
    }

    const statusCode =
      typeof (err as { statusCode?: unknown })?.statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : undefined;
    if (statusCode && statusCode >= 500) {
      throw err;
    }

    if (isLikelyJwtValidationError(err)) {
      throw new UnauthorizedError("Token invalido ou expirado");
    }

    throw err;
  }
}

export async function optionalAuth(request: FastifyRequest) {
  try {
    if (request.headers.authorization) {
      const user = await verifyRequestToken(request);
      request.user = user;
    }
  } catch (err) {
    const statusCode =
      typeof (err as { statusCode?: unknown })?.statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : undefined;
    if (statusCode && statusCode >= 500) {
      throw err;
    }
    request.user = undefined;
  }
}

export function authorize(...allowedRoles: string[]) {
  return async (request: FastifyRequest) => {
    if (!request.user) {
      throw new UnauthorizedError("Usuario nao autenticado");
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError("Voce nao tem permissao para acessar este recurso");
    }
  };
}
