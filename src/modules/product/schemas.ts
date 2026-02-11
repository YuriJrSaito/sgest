import { FastifySchema } from 'fastify';

// ==========================================
// SCHEMAS REUTILIZÁVEIS (BASE)
// ==========================================

const errorResponseSchema = {
  type: 'object',
  required: ['status', 'message'],
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
          keyword: { type: 'string' },
        },
      },
    },
  },
  additionalProperties: true,
};

// Schema do objeto product para respostas
const productResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    sku: { type: ['string', 'null'] },
    price: { type: 'number' },
    stock: { type: 'integer' },
    active: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

// Helper para criar schemas de resposta padronizados (JSend pattern)
const buildSuccessResponse = (dataSchema: object) => ({
  200: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', const: 'success' },
      message: { type: 'string' },
      data: dataSchema,
    },
  },
  201: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', const: 'success' },
      message: { type: 'string' },
      data: dataSchema,
    },
  },
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
});

// ==========================================
// SCHEMAS DAS ROTAS
// ==========================================

// Schema de paginação reutilizável
const paginationQuerySchema = {
  page: { type: 'integer', default: 1, minimum: 1 },
  limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
};

// Schema para ID nos params
const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
};

// POST /api/products - Criar produto
export const createProductSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['name', 'price'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 255,
      },
      description: {
        type: 'string',
        maxLength: 2000,
      },
      sku: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      price: {
        type: 'number',
        minimum: 0,
      },
      stock: {
        type: 'integer',
        minimum: 0,
        default: 0,
      },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['product'],
    properties: {
      product: productResponseSchema,
    },
  }),
};

// GET /api/products/:id - Buscar produto por ID
export const getProductSchema: FastifySchema = {
  params: idParamSchema,
  response: buildSuccessResponse({
    type: 'object',
    required: ['product'],
    properties: {
      product: productResponseSchema,
    },
  }),
};

// GET /api/products - Listar produtos
export const listProductsSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      ...paginationQuerySchema,
      active: { type: 'boolean' },
      minPrice: { type: 'number', minimum: 0 },
      maxPrice: { type: 'number', minimum: 0 },
      search: { type: 'string', maxLength: 255 },
      inStock: { type: 'boolean' },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['products', 'pagination'],
    properties: {
      products: {
        type: 'array',
        items: productResponseSchema,
      },
      pagination: {
        type: 'object',
        required: ['total', 'page', 'limit', 'totalPages'],
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  }),
};

// GET /api/products/stats - Estatisticas
export const productStatsSchema: FastifySchema = {
  response: buildSuccessResponse({
    type: 'object',
    required: ['stats'],
    properties: {
      stats: {
        type: 'object',
        required: ['total', 'active', 'inactive', 'outOfStock', 'lowStock'],
        properties: {
          total: { type: 'integer' },
          active: { type: 'integer' },
          inactive: { type: 'integer' },
          outOfStock: { type: 'integer' },
          lowStock: { type: 'integer' },
        },
      },
    },
  }),
};

// PUT /api/products/:id - Atualizar produto
export const updateProductSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 255,
      },
      description: {
        type: 'string',
        maxLength: 2000,
      },
      sku: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      price: {
        type: 'number',
        minimum: 0,
      },
      stock: {
        type: 'integer',
        minimum: 0,
      },
      active: {
        type: 'boolean',
      },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['product'],
    properties: {
      product: productResponseSchema,
    },
  }),
};

// PATCH /api/products/:id/stock - Atualizar estoque (valor absoluto)
export const updateStockSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: 'object',
    required: ['quantity'],
    properties: {
      quantity: {
        type: 'integer',
        minimum: 0,
      },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['product'],
    properties: {
      product: productResponseSchema,
    },
  }),
};

// PATCH /api/products/:id/stock/adjust - Ajustar estoque (delta)
export const adjustStockSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: 'object',
    required: ['delta'],
    properties: {
      delta: {
        type: 'integer',
        description: 'Valor positivo para incrementar, negativo para decrementar',
      },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['product'],
    properties: {
      product: productResponseSchema,
    },
  }),
};

// DELETE /api/products/:id - Remover produto (soft delete)
export const deleteProductSchema: FastifySchema = {
  params: idParamSchema,
  response: buildSuccessResponse({
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
  }),
};

// DELETE /api/products/:id/permanent - Remover permanentemente (admin only)
export const hardDeleteProductSchema: FastifySchema = {
  params: idParamSchema,
  response: buildSuccessResponse({
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
  }),
};
