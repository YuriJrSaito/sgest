// src/utils/errorMapper.ts
// Mapeia erros de dominio para status codes HTTP

import {
  DomainError,
  AuthenticationError,
  ResourceNotFoundError,
  RateLimitError,
  DomainConflictError,
} from "../domain/errors/DomainErrors";

type DomainErrorConstructor = new (message?: string) => DomainError;

const DOMAIN_ERROR_STATUS_MAP: Array<[DomainErrorConstructor, number]> = [
  [AuthenticationError, 401],
  [ResourceNotFoundError, 404],
  [RateLimitError, 429],
  [DomainConflictError, 409],
];

export function mapDomainErrorToStatusCode(error: DomainError): number {
  for (const [ErrorClass, code] of DOMAIN_ERROR_STATUS_MAP) {
    if (error instanceof ErrorClass) return code;
  }
  return 400;
}
