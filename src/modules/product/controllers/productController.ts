import { FastifyRequest, FastifyReply } from 'fastify';
import productService from '../services/productService';
import {
  CreateProductDTO,
  UpdateProductDTO,
  ProductListParams,
} from '../../../types';

interface IdParam {
  id: string;
}

interface StockBody {
  quantity: number;
}

interface AdjustStockBody {
  delta: number;
}

class ProductController {
  /**
   * POST /api/products
   * Cria um novo produto
   */
  async create(
    request: FastifyRequest<{ Body: CreateProductDTO }>,
    reply: FastifyReply
  ) {
    const product = await productService.create(request.body, request.user!);

    return reply.status(201).send({
      status: 'success',
      message: 'Produto criado com sucesso',
      data: { product },
    });
  }

  /**
   * GET /api/products/:id
   * Busca produto por ID
   */
  async findById(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    const product = await productService.findById(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      data: { product },
    });
  }

  /**
   * GET /api/products
   * Lista produtos com filtros e paginacao
   */
  async findAll(
    request: FastifyRequest<{ Querystring: ProductListParams }>,
    reply: FastifyReply
  ) {
    const result = await productService.findAll(request.query, request.user!);

    return reply.send({
      status: 'success',
      data: {
        products: result.data,
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
   * GET /api/products/stats
   * Estatisticas de produtos (admin)
   */
  async getStats(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const stats = await productService.getStats(request.user!);

    return reply.send({
      status: 'success',
      data: { stats },
    });
  }

  /**
   * PUT /api/products/:id
   * Atualiza produto
   */
  async update(
    request: FastifyRequest<{ Params: IdParam; Body: UpdateProductDTO }>,
    reply: FastifyReply
  ) {
    const product = await productService.update(
      request.params.id,
      request.body,
      request.user!
    );

    return reply.send({
      status: 'success',
      message: 'Produto atualizado com sucesso',
      data: { product },
    });
  }

  /**
   * PATCH /api/products/:id/stock
   * Atualiza estoque do produto (valor absoluto)
   */
  async updateStock(
    request: FastifyRequest<{ Params: IdParam; Body: StockBody }>,
    reply: FastifyReply
  ) {
    const product = await productService.updateStock(
      request.params.id,
      request.body.quantity,
      request.user!
    );

    return reply.send({
      status: 'success',
      message: 'Estoque atualizado com sucesso',
      data: { product },
    });
  }

  /**
   * PATCH /api/products/:id/stock/adjust
   * Ajusta estoque (incrementa/decrementa)
   */
  async adjustStock(
    request: FastifyRequest<{ Params: IdParam; Body: AdjustStockBody }>,
    reply: FastifyReply
  ) {
    const product = await productService.adjustStock(
      request.params.id,
      request.body.delta,
      request.user!
    );

    return reply.send({
      status: 'success',
      message: 'Estoque ajustado com sucesso',
      data: { product },
    });
  }

  /**
   * DELETE /api/products/:id
   * Remove produto (soft delete)
   */
  async delete(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    await productService.delete(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      message: 'Produto removido com sucesso',
    });
  }

  /**
   * DELETE /api/products/:id/permanent
   * Remove produto permanentemente (apenas admin)
   */
  async hardDelete(
    request: FastifyRequest<{ Params: IdParam }>,
    reply: FastifyReply
  ) {
    await productService.hardDelete(request.params.id, request.user!);

    return reply.send({
      status: 'success',
      message: 'Produto removido permanentemente. Esta acao e irreversivel e pode impactar kits existentes.',
    });
  }
}

export default new ProductController();
