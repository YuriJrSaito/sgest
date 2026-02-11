import { FastifySchema } from 'fastify';

// ==========================================
// SCHEMAS REUTILIZÁVEIS
// ==========================================

const errorResponseSchema = {
  type: 'object',
  required: ['status', 'message'],
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  additionalProperties: true,
};

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
};

const paginationQuerySchema = {
  page: { type: 'integer', default: 1, minimum: 1 },
  limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
};

const kitResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    code: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['draft', 'assembling', 'delivered', 'returned'] },
    reseller_id: { type: ['string', 'null'] },
    assigned_at: { type: ['string', 'null'] },
    returned_at: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    created_by: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const kitWithDetailsResponseSchema = {
  type: 'object',
  properties: {
    ...kitResponseSchema.properties,
    reseller_name: { type: ['string', 'null'] },
    item_count: { type: 'integer' },
    total_value: { type: 'number' },
  },
};

const kitItemResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    kit_id: { type: 'string', format: 'uuid' },
    product_id: { type: 'string', format: 'uuid' },
    quantity: { type: 'integer' },
    unit_price: { type: 'number' },
    product_name: { type: 'string' },
    product_sku: { type: ['string', 'null'] },
    created_at: { type: 'string', format: 'date-time' },
  },
};

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
  500: errorResponseSchema,
});

// ==========================================
// KIT SCHEMAS
// ==========================================

export const createKitSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 255 },
      description: { type: 'string', maxLength: 2000 },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: { kit: kitResponseSchema },
  }),
};

export const listKitsSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      ...paginationQuerySchema,
      status: { type: 'string', enum: ['draft', 'assembling', 'delivered', 'returned'] },
      resellerId: { type: 'string', format: 'uuid' },
      search: { type: 'string', maxLength: 255 },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: {
      kits: { type: 'array', items: kitWithDetailsResponseSchema },
      pagination: {
        type: 'object',
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

export const getKitSchema: FastifySchema = {
  params: idParamSchema,
  response: buildSuccessResponse({
    type: 'object',
    properties: { kit: kitWithDetailsResponseSchema },
  }),
};

export const updateKitSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 255 },
      description: { type: 'string', maxLength: 2000 },
      notes: { type: 'string', maxLength: 2000 },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: { kit: kitResponseSchema },
  }),
};

export const deleteKitSchema: FastifySchema = {
  params: idParamSchema,
  response: buildSuccessResponse({
    type: 'object',
    properties: { message: { type: 'string' } },
  }),
};

export const updateKitStatusSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['draft', 'assembling', 'delivered', 'returned'] },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: { kit: kitResponseSchema },
  }),
};

export const assignKitSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: 'object',
    required: ['resellerId'],
    properties: {
      resellerId: { type: 'string', format: 'uuid' },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: { kit: kitResponseSchema },
  }),
};

export const unassignKitSchema: FastifySchema = {
  params: idParamSchema,
  response: buildSuccessResponse({
    type: 'object',
    properties: { kit: kitResponseSchema },
  }),
};

// ==========================================
// KIT ITEMS SCHEMAS
// ==========================================

export const listKitItemsSchema: FastifySchema = {
  params: idParamSchema,
  response: buildSuccessResponse({
    type: 'object',
    properties: {
      items: { type: 'array', items: kitItemResponseSchema },
    },
  }),
};

export const addKitItemSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: 'object',
    required: ['productId', 'quantity'],
    properties: {
      productId: { type: 'string', format: 'uuid' },
      quantity: { type: 'integer', minimum: 1 },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: { item: kitItemResponseSchema },
  }),
};

export const updateKitItemSchema: FastifySchema = {
  params: idParamSchema,
  body: {
    type: 'object',
    required: ['quantity'],
    properties: {
      quantity: { type: 'integer', minimum: 1 },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: { item: kitItemResponseSchema },
  }),
};

export const removeKitItemSchema: FastifySchema = {
  params: idParamSchema,
  response: buildSuccessResponse({
    type: 'object',
    properties: { message: { type: 'string' } },
  }),
};
