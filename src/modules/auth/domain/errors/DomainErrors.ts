// Re-export de erros de dominio compartilhados
// Mantido para compatibilidade - imports existentes continuam funcionando
export {
  DomainError,
  AuthenticationError,
  ResourceNotFoundError,
  RateLimitError,
  DomainConflictError,
} from "../../../../domain/errors/DomainErrors";
