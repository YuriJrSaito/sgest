// src/utils/requestUtils.ts
import { FastifyRequest } from 'fastify';
import { RequestContext } from '../types';

/**
 * Extrai o endereço IP do cliente da requisição
 * Leva em consideração proxies (x-forwarded-for, x-real-ip)
 * @param request Requisição Fastify
 * @returns Endereço IP do cliente
 */
export function getClientIp(request: FastifyRequest): string {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (forwardedFor) {
    // x-forwarded-for pode conter múltiplos IPs separados por vírgula
    // O primeiro é o IP original do cliente
    const ips = (forwardedFor as string).split(',');
    return ips[0].trim();
  }

  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return realIp as string;
  }

  // Fallback para o IP da requisição
  return request.ip || 'unknown';
}

/**
 * Extrai o User-Agent da requisição
 * @param request Requisição Fastify
 * @returns User-Agent string
 */
export function getUserAgent(request: FastifyRequest): string {
  return (request.headers['user-agent'] as string) || 'unknown';
}

/**
 * Extrai o contexto da requisição (IP + User-Agent)
 * Útil para auditoria e rastreamento de segurança
 * @param request Requisição Fastify
 * @returns Contexto com IP e User-Agent
 */
export function getRequestContext(request: FastifyRequest): RequestContext {
  return {
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  };
}
