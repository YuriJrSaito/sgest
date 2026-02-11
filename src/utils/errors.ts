import { FastifyRequest, FastifyReply } from 'fastify';
import { getHttpLogger } from '../config/logger';
import { DomainError } from '../domain/errors/DomainErrors';
import { mapDomainErrorToStatusCode } from './errorMapper';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Requisi\u00e7\u00e3o inv\u00e1lida') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'N\u00e3o autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso n\u00e3o encontrado') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflito de dados') {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Muitas requisicoes. Tente novamente mais tarde') {
    super(message, 429);
  }
}

export interface ValidationErrorDetail {
  field?: string;
  message: string;
  keyword?: string;
}

export class ValidationError extends AppError {
  public readonly errors: ValidationErrorDetail[];

  constructor(
    message: string = 'Erro de valida\u00e7\u00e3o',
    errors: ValidationErrorDetail[] = []
  ) {
    super(message, 422);
    this.errors = errors;
  }
}

type FastifyValidationItem = {
  instancePath?: string;
  message?: string;
  keyword?: string;
  params?: {
    missingProperty?: string;
  };
};

function normalizeValidationErrors(
  errors: FastifyValidationItem[]
): ValidationErrorDetail[] {
  return errors.map((item) => {
    const fieldFromPath = item.instancePath
      ? item.instancePath.replace(/^\//, '').replace(/\//g, '.')
      : undefined;
    const field = item.params?.missingProperty || fieldFromPath;

    const detail: ValidationErrorDetail = {
      message: item.message || 'Erro de valida\u00e7\u00e3o',
    };

    if (field) {
      detail.field = field;
    }

    if (item.keyword) {
      detail.keyword = item.keyword;
    }

    return detail;
  });
}

function getSafeMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Requisi\u00e7\u00e3o inv\u00e1lida';
    case 401:
      return 'N\u00e3o autorizado';
    case 403:
      return 'Acesso negado';
    case 404:
      return 'Recurso n\u00e3o encontrado';
    case 409:
      return 'Conflito de dados';
    case 422:
      return 'Erro de valida\u00e7\u00e3o';
    case 429:
      return 'Muitas requisi\u00e7\u00f5es. Tente novamente mais tarde';
    case 503:
      return 'Servi\u00e7o temporariamente indispon\u00edvel';
    default:
      return statusCode >= 500
        ? 'Erro interno do servidor'
        : 'Erro ao processar requisi\u00e7\u00e3o';
  }
}

export function errorHandler(
  error: Error | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const statusCode = error instanceof DomainError
    ? mapDomainErrorToStatusCode(error)
    : error instanceof AppError
      ? error.statusCode
      : typeof (error as unknown as { statusCode?: unknown }).statusCode === 'number'
        ? (error as unknown as { statusCode: number }).statusCode
        : 500;
  const httpStatus = statusCode >= 400 ? statusCode : 500;
  const isOperational =
    (error instanceof DomainError && error.isOperational && httpStatus < 500) ||
    (error instanceof AppError && error.isOperational && httpStatus < 500);
  const requestId = request.id;
  const validationErrors =
    'validation' in error && Array.isArray((error as { validation: unknown[] }).validation)
      ? ((error as { validation: FastifyValidationItem[] }).validation)
      : null;

  // Log estruturado com nivel apropriado
  const logData = {
    err: error,
    url: request.url,
    method: request.method,
    statusCode: httpStatus,
    requestId,
  };

  if (isOperational) {
    getHttpLogger().warn(logData, 'Erro operacional');
  } else {
    getHttpLogger().error(logData, 'Erro inesperado');
  }

  const responsePayload: Record<string, unknown> = {
    status: 'error',
    message: getSafeMessage(httpStatus),
    requestId,
  };

  if (isOperational) {
    responsePayload.message = error.message;
    if (error instanceof ValidationError) {
      responsePayload.errors = error.errors;
    }
    return reply.status(httpStatus).send(responsePayload);
  }

  // Fastify validation errors have a 'validation' property
  if (validationErrors) {
    responsePayload.message = 'Erro de valida\u00e7\u00e3o';
    responsePayload.errors = normalizeValidationErrors(validationErrors);
    return reply.status(400).send(responsePayload);
  }

  return reply.status(httpStatus).send(responsePayload);
}

