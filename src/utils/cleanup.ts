// src/utils/cleanup.ts
import refreshTokenRepository from '../modules/auth/repositories/refreshTokenRepository';
import tokenBlacklistRepository from '../modules/auth/repositories/tokenBlacklistRepository';
import auditLogRepository from '../modules/auth/repositories/auditLogRepository';
import { createModuleLogger } from '../config/logger';

// Getter para obter logger atualizado (apos Fastify injetar o seu)
const getCleanupLogger = () => createModuleLogger('cleanup');

/**
 * Limpa tokens e logs expirados do banco de dados
 * Deve ser executado periodicamente (ex: a cada 24 horas)
 */
export async function cleanupExpiredData(): Promise<{
  refreshTokens: number;
  blacklistedTokens: number;
  auditLogs: number;
}> {
  const refreshTokens = await refreshTokenRepository.deleteExpired();
  const blacklistedTokens = await tokenBlacklistRepository.deleteExpired();
  const auditLogs = await auditLogRepository.deleteOld(90);

  getCleanupLogger().info({
    refreshTokens,
    blacklistedTokens,
    auditLogs,
  }, 'Cleanup concluido');

  return { refreshTokens, blacklistedTokens, auditLogs };
}

/**
 * Inicia o cleanup automático em intervalo definido
 * @param intervalHours Intervalo em horas (padrão: 24)
 */
export function startCleanupScheduler(intervalHours: number = 24): NodeJS.Timeout {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Executar uma vez na inicialização
  cleanupExpiredData().catch(err => {
    getCleanupLogger().error({ err }, 'Erro no cleanup inicial');
  });

  // Agendar execuções periódicas
  const timer = setInterval(() => {
    cleanupExpiredData().catch(err => {
      getCleanupLogger().error({ err }, 'Erro no cleanup agendado');
    });
  }, intervalMs);

  getCleanupLogger().info({ intervalHours }, 'Cleanup agendado');

  return timer;
}
