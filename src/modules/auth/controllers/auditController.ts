// src/modules/auth/controllers/auditController.ts
import { injectable, inject } from "tsyringe";
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from "../services/auditService";
import { AuditLog } from "../../../types";
import { AuthenticationError } from '../domain/errors/DomainErrors';

function requireUser(request: FastifyRequest) {
  const user = request.user;
  if (!user) {
    throw new AuthenticationError('Usuario nao autenticado');
  }
  return user;
}

function mapAuditLogToResponse(log: AuditLog) {
  return {
    id: log.id,
    action: log.action,
    status: log.status,
    resourceType: log.resource_type,
    resourceId: log.resource_id,
    ipAddress: log.ip_address,
    userAgent: log.user_agent,
    metadata: log.metadata,
    createdAt: log.created_at,
  };
}

@injectable()
export class AuditController {
  constructor(
    @inject(AuditService) private auditService: AuditService
  ) {}

  async getLoginHistory(
    request: FastifyRequest<{
      Querystring: { page?: number; limit?: number };
    }>,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;
    const page = request.query.page || 1;
    const limit = request.query.limit || 10;

    const result = await this.auditService.getLoginHistory(userId, { page, limit });

    return reply.code(200).send({
      status: 'success',
      data: {
        logs: result.data.map(mapAuditLogToResponse),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  async getAuditHistory(
    request: FastifyRequest<{
      Querystring: { page?: number; limit?: number };
    }>,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;
    const page = request.query.page || 1;
    const limit = request.query.limit || 20;

    const result = await this.auditService.getByUserId(userId, { page, limit });

    return reply.code(200).send({
      status: 'success',
      data: {
        logs: result.data.map(mapAuditLogToResponse),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  async getStats(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = requireUser(request).id;
    const stats = await this.auditService.getUserStats(userId);

    return reply.code(200).send({
      status: 'success',
      data: {
        stats: {
          totalLogins: stats.totalLogins,
          failedLogins: stats.failedLogins,
          lastLogin: stats.lastLogin,
          lastIpAddress: stats.lastIpAddress,
        },
      },
    });
  }
}
