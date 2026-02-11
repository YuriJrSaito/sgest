// src/modules/auth/services/auditService.ts
import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../tokens";
import { AuditLogRepository } from "../repositories/auditLogRepository";
import { AuditLog, PaginationParams, PaginatedResponse, RequestContext } from '../../../types';
import { getAuthLogger } from '../../../config/logger';

@injectable()
export class AuditService {
  constructor(
    @inject(AUTH_TOKENS.AuditLogRepository) private auditLogRepository: AuditLogRepository
  ) {}

  async log(data: {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    status: 'success' | 'failure' | 'blocked';
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditLogRepository.create(data);
    } catch (error) {
      getAuthLogger().error({ err: error, auditData: data }, 'Erro ao registrar log de auditoria');
    }
  }

  async logLogin(
    userId: string | undefined,
    email: string,
    status: 'success' | 'failure',
    context: RequestContext,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action: status === 'success' ? 'login' : 'login_failed',
      resourceType: 'auth',
      resourceId: email,
      status,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email,
        ...metadata,
      },
    });
  }

  async logLogout(
    userId: string,
    context: RequestContext,
    logoutAll: boolean = false
  ): Promise<void> {
    await this.log({
      userId,
      action: logoutAll ? 'logout_all' : 'logout',
      resourceType: 'auth',
      status: 'success',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        logoutAll,
      },
    });
  }

  async logPasswordChange(
    userId: string,
    context: RequestContext
  ): Promise<void> {
    await this.log({
      userId,
      action: 'password_change',
      resourceType: 'auth',
      status: 'success',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  async logPasswordResetRequest(
    userId: string | undefined,
    email: string,
    context: RequestContext
  ): Promise<void> {
    await this.log({
      userId,
      action: 'password_reset_request',
      resourceType: 'auth',
      resourceId: email,
      status: 'success',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email,
      },
    });
  }

  async logPasswordReset(
    userId: string,
    context: RequestContext
  ): Promise<void> {
    await this.log({
      userId,
      action: 'password_reset_complete',
      resourceType: 'auth',
      status: 'success',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  async logBruteForceBlock(
    email: string,
    context: RequestContext
  ): Promise<void> {
    await this.log({
      action: 'brute_force_block',
      resourceType: 'auth',
      resourceId: email,
      status: 'blocked',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email,
      },
    });
  }

  async logTokenRefresh(
    userId: string | undefined,
    context: RequestContext,
    success: boolean = true
  ): Promise<void> {
    await this.log({
      userId,
      action: 'token_refresh',
      resourceType: 'auth',
      status: success ? 'success' : 'failure',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  async logTokenReuseDetected(
    userId: string,
    context: RequestContext
  ): Promise<void> {
    await this.log({
      userId,
      action: 'token_reuse_detected',
      resourceType: 'security',
      status: 'blocked',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        severity: 'high',
        action_taken: 'revoked_token_family',
      },
    });
  }

  async getByUserId(
    userId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    return await this.auditLogRepository.findByUserId(userId, pagination);
  }

  async getLoginHistory(
    userId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<AuditLog>> {
    return await this.auditLogRepository.findLoginHistoryByUserId(userId, pagination);
  }

  async getRecentLoginHistory(
    userId: string,
    limit: number = 10
  ): Promise<AuditLog[]> {
    return await this.auditLogRepository.findRecentLoginsByUserId(userId, limit);
  }

  async getUserStats(userId: string): Promise<{
    totalLogins: number;
    failedLogins: number;
    lastLogin?: Date;
    lastIpAddress?: string;
  }> {
    return await this.auditLogRepository.getStatsByUserId(userId);
  }

  async getSuspiciousActivityByIp(
    ipAddress: string,
    limit: number = 20
  ): Promise<AuditLog[]> {
    return await this.auditLogRepository.findByIpAddress(ipAddress, limit);
  }
}
