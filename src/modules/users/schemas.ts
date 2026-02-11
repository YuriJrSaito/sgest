import { FastifySchema } from 'fastify';

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

const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string' },
    role: { type: 'string', enum: ['ADMIN', 'GERENTE', 'RESELLER'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
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
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  422: errorResponseSchema,
  500: errorResponseSchema,
});

const paginationQuerySchema = {
  page: { type: 'integer', default: 1, minimum: 1 },
  limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
};

export const listUsersSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      ...paginationQuerySchema,
      role: { type: 'string', enum: ['ADMIN', 'GERENTE', 'RESELLER'] },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
      search: { type: 'string', maxLength: 255 },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['users', 'pagination'],
    properties: {
      users: {
        type: 'array',
        items: userResponseSchema,
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
