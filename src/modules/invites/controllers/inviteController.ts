import { FastifyRequest, FastifyReply } from 'fastify';
import inviteService from '../services/inviteService';
import {
  CreateInviteDTO,
  AcceptInviteDTO,
  InviteListParams,
} from '../../../types';

interface IdParam {
  id: string;
}

interface TokenParam {
  token: string;
}

class InviteController {
  /**
   * POST /api/invites
   * Cria um novo convite (apenas admin)
   */
  async create(
    request: FastifyRequest<{ Body: CreateInviteDTO }>,
    reply: FastifyReply
  ) {
    const invite = await inviteService.create(request.body, request.user!);

    return reply.status(201).send({
      status: 'success',
      message: 'Convite criado com sucesso',
      data: {
        invite: {
          id: invite.id,
          email: invite.email,
          token: invite.token,
          roleToAssign: invite.role_to_assign,
          expiresAt: invite.expires_at,
          createdAt: invite.created_at,
        },
        // URL de convite para facilitar o envio
        inviteUrl: `/register?token=${invite.token}`,
      },
    });
  }

  /**
   * GET /api/invites
   * Lista convites (apenas admin)
   */
  async list(
    request: FastifyRequest<{ Querystring: InviteListParams }>,
    reply: FastifyReply
  ) {
    const result = await inviteService.list(request.query, request.user!);

    return reply.send({
      status: 'success',
      data: {
        invites: result.data.map(invite => ({
          id: invite.id,
          email: invite.email,
          roleToAssign: invite.role_to_assign,
          expiresAt: invite.expires_at,
          usedAt: invite.used_at,
          createdAt: invite.created_at,
          creator: invite.creator,
          status: invite.used_at
            ? 'used'
            : new Date(invite.expires_at) < new Date()
            ? 'expired'
            : 'pending',
        })),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }

  /**
   * GET /api/invites/validate/:token
   * Valida token de convite (publico)
   */
  async validateToken(
    request: FastifyRequest<{ Params: TokenParam }>,
    reply: FastifyReply
  ) {
    const validation = await inviteService.validateToken(request.params.token);

    if (!validation.valid) {
      return reply.status(400).send({
        status: 'error',
        message: validation.error,
      });
    }

    return reply.send({
      status: 'success',
      data: {
        valid: true,
        invite: {
          email: validation.invite!.email,
          roleToAssign: validation.invite!.role_to_assign,
          expiresAt: validation.invite!.expires_at,
        },
      },
    });
  }

  /**
   * POST /api/invites/accept
   * Aceita convite e cria usuario (publico)
   */
  async accept(
    request: FastifyRequest<{ Body: AcceptInviteDTO }>,
    reply: FastifyReply
  ) {
    const user = await inviteService.accept(request.body);

    return reply.status(201).send({
      status: 'success',
      message: 'Conta criada com sucesso',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  }

  /**
   * GET /api/invites/:id
   * Busca convite por ID (apenas admin)
   */
  async findById(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    const invite = await inviteService.findById(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      data: {
        invite: {
          id: invite.id,
          email: invite.email,
          token: invite.token,
          roleToAssign: invite.role_to_assign,
          expiresAt: invite.expires_at,
          usedAt: invite.used_at,
          createdAt: invite.created_at,
          status: invite.used_at
            ? 'used'
            : new Date(invite.expires_at) < new Date()
            ? 'expired'
            : 'pending',
        },
      },
    });
  }

  /**
   * DELETE /api/invites/:id
   * Revoga convite (apenas admin)
   */
  async revoke(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    await inviteService.revoke(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      message: 'Convite revogado com sucesso',
    });
  }

  /**
   * POST /api/invites/:id/resend
   * Reenvia convite (apenas admin)
   */
  async resend(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    const invite = await inviteService.resend(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      message: 'Convite reenviado com sucesso',
      data: {
        invite: {
          id: invite.id,
          email: invite.email,
          token: invite.token,
          expiresAt: invite.expires_at,
        },
        inviteUrl: `/register?token=${invite.token}`,
      },
    });
  }
}

export default new InviteController();
