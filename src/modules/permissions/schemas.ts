import { FastifySchema } from 'fastify';

const errorResponseSchema = {
  type: 'object',
  required: ['status', 'message'],
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
    errors: { type: 'array', items: { type: 'object', additionalProperties: true } },
  },
};

const permissionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    resource: { type: 'string' },
    action: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

const roleWithPermissionsSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    is_system: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    permissions: { type: 'array', items: permissionSchema },
  },
};

export const listPermissionsSchema: FastifySchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', const: 'success' },
        data: {
          type: 'object',
          properties: {
            permissions: {
              type: 'array',
              items: permissionSchema,
            },
          },
        },
      },
    },
    401: errorResponseSchema,
    403: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export const listRolesSchema: FastifySchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', const: 'success' },
        data: {
          type: 'object',
          properties: {
            roles: {
              type: 'array',
              items: roleWithPermissionsSchema,
            },
          },
        },
      },
    },
    401: errorResponseSchema,
    403: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export const updateRolePermissionsSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['roleCode'],
    properties: {
      roleCode: { type: 'string', minLength: 2, maxLength: 50 },
    },
  },
  body: {
    type: 'object',
    required: ['permissionIds'],
    properties: {
      permissionIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', const: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            role: roleWithPermissionsSchema,
          },
        },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    422: errorResponseSchema,
    500: errorResponseSchema,
  },
};
