// src/domain/errors/DomainErrors.ts
// Erros de dominio puros - sem dependencia de HTTP ou framework

export class DomainError extends Error {
  public readonly isOperational: boolean;

  constructor(message: string) {
    super(message);
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = "Nao autorizado") {
    super(message);
  }
}

export class ResourceNotFoundError extends DomainError {
  constructor(message = "Recurso nao encontrado") {
    super(message);
  }
}

export class RateLimitError extends DomainError {
  constructor(message = "Muitas requisicoes. Tente novamente mais tarde") {
    super(message);
  }
}

export class DomainConflictError extends DomainError {
  constructor(message = "Conflito de dados") {
    super(message);
  }
}
