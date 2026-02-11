// src/utils/tokenUtils.ts
import crypto from 'crypto';

/**
 * Gera um token seguro aleatório
 * @param bytes Número de bytes para gerar (padrão: 32)
 * @returns Token em formato hexadecimal
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Gera hash SHA-256 de um token
 * @param token Token para hash
 * @returns Hash do token em formato hexadecimal
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Gera um JWT ID (JTI) único usando UUID v4
 * @returns UUID v4
 */
export function generateJti(): string {
  return generateUUID();
}

/**
 * Gera um Family ID para rastreamento de refresh tokens
 * @returns UUID v4
 */
export function generateFamilyId(): string {
  return generateUUID();
}
