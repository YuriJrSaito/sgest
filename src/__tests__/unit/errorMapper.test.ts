import { mapDomainErrorToStatusCode } from "../../utils/errorMapper";
import {
  AuthenticationError,
  DomainConflictError,
  DomainError,
  RateLimitError,
  ResourceNotFoundError,
} from "../../domain/errors/DomainErrors";
import { InvalidTokenError } from "../../modules/auth/domain/errors/AuthErrors";

class UnknownDomainError extends DomainError {
  constructor() {
    super("unknown");
  }
}

describe("errorMapper.mapDomainErrorToStatusCode", () => {
  it("deve mapear AuthenticationError para 401", () => {
    expect(mapDomainErrorToStatusCode(new AuthenticationError())).toBe(401);
  });

  it("deve mapear ResourceNotFoundError para 404", () => {
    expect(mapDomainErrorToStatusCode(new ResourceNotFoundError())).toBe(404);
  });

  it("deve mapear RateLimitError para 429", () => {
    expect(mapDomainErrorToStatusCode(new RateLimitError())).toBe(429);
  });

  it("deve mapear DomainConflictError para 409", () => {
    expect(mapDomainErrorToStatusCode(new DomainConflictError())).toBe(409);
  });

  it("deve mapear erro de auth derivado para 401", () => {
    expect(mapDomainErrorToStatusCode(new InvalidTokenError())).toBe(401);
  });

  it("deve retornar 400 para erro de dominio nao mapeado", () => {
    expect(mapDomainErrorToStatusCode(new UnknownDomainError())).toBe(400);
  });
});
