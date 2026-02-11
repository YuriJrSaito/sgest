import { FastifyRequest, FastifyReply } from 'fastify';
import kitService from '../services/kitService';
import {
  CreateKitDTO,
  UpdateKitDTO,
  AddKitItemDTO,
  UpdateKitItemDTO,
  AssignKitDTO,
  KitListParams,
  KitStatus,
} from '../../../types';

interface IdParam {
  id: string;
}

interface StatusBody {
  status: KitStatus;
}

class KitController {
  /**
   * POST /api/kits
   */
  async create(
    request: FastifyRequest<{ Body: CreateKitDTO }>,
    reply: FastifyReply
  ) {
    const kit = await kitService.create(request.body, request.user!);

    return reply.status(201).send({
      status: 'success',
      message: 'Kit criado com sucesso',
      data: { kit },
    });
  }

  /**
   * GET /api/kits
   */
  async list(
    request: FastifyRequest<{ Querystring: KitListParams }>,
    reply: FastifyReply
  ) {
    const result = await kitService.list(request.query, request.user!);

    return reply.send({
      status: 'success',
      data: {
        kits: result.data,
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
   * GET /api/kits/:id
   */
  async findById(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    const kit = await kitService.findById(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      data: { kit },
    });
  }

  /**
   * PUT /api/kits/:id
   */
  async update(
    request: FastifyRequest<{ Params: IdParam; Body: UpdateKitDTO }>,
    reply: FastifyReply
  ) {
    const kit = await kitService.update(request.params.id, request.body, request.user!);

    return reply.send({
      status: 'success',
      message: 'Kit atualizado com sucesso',
      data: { kit },
    });
  }

  /**
   * DELETE /api/kits/:id
   */
  async delete(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    await kitService.delete(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      message: 'Kit removido com sucesso',
    });
  }

  /**
   * PATCH /api/kits/:id/status
   */
  async updateStatus(
    request: FastifyRequest<{ Params: IdParam; Body: StatusBody }>,
    reply: FastifyReply
  ) {
    const kit = await kitService.updateStatus(
      request.params.id,
      request.body.status,
      request.user!
    );

    return reply.send({
      status: 'success',
      message: `Status alterado para "${kit.status}"`,
      data: { kit },
    });
  }

  /**
   * POST /api/kits/:id/assign
   */
  async assign(
    request: FastifyRequest<{ Params: IdParam; Body: AssignKitDTO }>,
    reply: FastifyReply
  ) {
    const kit = await kitService.assign(
      request.params.id,
      request.body.resellerId,
      request.user!
    );

    return reply.send({
      status: 'success',
      message: 'Kit atribuido com sucesso',
      data: { kit },
    });
  }

  /**
   * POST /api/kits/:id/unassign
   */
  async unassign(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    const kit = await kitService.unassign(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      message: 'Revendedor removido do kit',
      data: { kit },
    });
  }

  // ==========================================
  // ITEMS
  // ==========================================

  /**
   * GET /api/kits/:id/items
   */
  async listItems(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    const items = await kitService.listItems(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      data: { items },
    });
  }

  /**
   * POST /api/kits/:id/items
   */
  async addItem(
    request: FastifyRequest<{ Params: IdParam; Body: AddKitItemDTO }>,
    reply: FastifyReply
  ) {
    const item = await kitService.addItem(
      request.params.id,
      request.body,
      request.user!
    );

    return reply.status(201).send({
      status: 'success',
      message: 'Item adicionado ao kit',
      data: { item },
    });
  }

  /**
   * PUT /api/kit-items/:id
   */
  async updateItem(
    request: FastifyRequest<{ Params: IdParam; Body: UpdateKitItemDTO }>,
    reply: FastifyReply
  ) {
    const item = await kitService.updateItem(
      request.params.id,
      request.body.quantity,
      request.user!
    );

    return reply.send({
      status: 'success',
      message: 'Quantidade atualizada',
      data: { item },
    });
  }

  /**
   * DELETE /api/kit-items/:id
   */
  async removeItem(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    await kitService.removeItem(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      message: 'Item removido do kit',
    });
  }
}

export default new KitController();
