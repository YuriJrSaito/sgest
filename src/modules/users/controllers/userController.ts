import { FastifyReply, FastifyRequest } from 'fastify';
import userService from '../services/userService';
import { UserListParams } from '../../../types';

class UserController {
  async list(
    request: FastifyRequest<{ Querystring: UserListParams }>,
    reply: FastifyReply
  ) {
    const result = await userService.list(request.query, request.user!);

    return reply.send({
      status: 'success',
      data: {
        users: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  }
}

export default new UserController();
