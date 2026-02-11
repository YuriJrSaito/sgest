// src/modules/auth/domain/errors/AuthErrors.ts
// Erros de dominio especificos do modulo de autenticacao

import { AuthenticationError, RateLimitError, ResourceNotFoundError } from "./DomainErrors";

/**
 * Credenciais invalidas (email ou senha incorretos)
 */
export class InvalidCredentialsError extends AuthenticationError {
  constructor(message = "Email ou senha invalidos") {
    super(message);
  }
}

/**
 * Conta bloqueada por tentativas excessivas de login
 */
export class AccountLockedError extends RateLimitError {
  constructor(message = "Conta temporariamente bloqueada. Tente novamente mais tarde") {
    super(message);
  }
}

/**
 * Usuario inativo
 */
export class InactiveUserError extends AuthenticationError {
  constructor(message = "Usuario inativo") {
    super(message);
  }
}

/**
 * Token expirado
 */
export class TokenExpiredError extends AuthenticationError {
  constructor(message = "Token expirado") {
    super(message);
  }
}

/**
 * Token revogado (logout ou reuso detectado)
 */
export class TokenRevokedError extends AuthenticationError {
  constructor(message = "Token revogado") {
    super(message);
  }
}

/**
 * Token invalido (assinatura invalida, malformado)
 */
export class InvalidTokenError extends AuthenticationError {
  constructor(message = "Token invalido") {
    super(message);
  }
}

/**
 * Sessao nao encontrada
 */
export class SessionNotFoundError extends ResourceNotFoundError {
  constructor(message = "Sessao nao encontrada") {
    super(message);
  }
}

/**
 * Senha atual incorreta (ao trocar senha)
 */
export class InvalidCurrentPasswordError extends AuthenticationError {
  constructor(message = "Senha atual incorreta") {
    super(message);
  }
}

/**
 * Refresh em andamento (lock de concorrencia)
 */
export class RefreshInProgressError extends RateLimitError {
  constructor(message = "Refresh em andamento. Tente novamente.") {
    super(message);
  }
}
