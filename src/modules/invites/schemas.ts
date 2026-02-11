import { FastifySchema } from 'fastify';

// ==========================================
// SCHEMAS REUTILIZAVEIS (BASE)
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
        },
      },
    },
  },
  additionalProperties: true,
};

// Schema do objeto invite para respostas
const inviteResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    token: { type: 'string' },
    roleToAssign: { type: 'string', enum: ['ADMIN', 'GERENTE', 'RESELLER'] },
    expiresAt: { type: 'string', format: 'date-time' },
    usedAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: ['pending', 'used', 'expired'] },
    creator: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
};

// ==========================================
// SCHEMAS DAS ROTAS
// ==========================================

// Schema para ID nos params
const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
};

// Schema para token nos params
const tokenParamSchema = {
  type: 'object',
  required: ['token'],
  properties: {
    token: { type: 'string' },
  },
};

// POST /api/invites - Criar convite
export const createInviteSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['email', 'roleToAssign'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
      },
      roleToAssign: {
        type: 'string',
        enum: ['ADMIN', 'GERENTE', 'RESELLER'],
      },
      commissionRate: {
        type: 'number',
        minimum: 0,
        maximum: 100,
      },
    },
  },
  response: {
    201: {
      type: 'object',
      required: ['status', 'message', 'data'],
      properties: {
        status: { type: 'string', const: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            invite: inviteResponseSchema,
            inviteUrl: { type: 'string' },
          },
        },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    409: errorResponseSchema,
  },
};

// GET /api/invites - Listar convites
export const listInvitesSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', default: 1, minimum: 1 },
      limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
      status: { type: 'string', enum: ['pending', 'used', 'expired'] },
      email: { type: 'string', maxLength: 255 },
    },
  },
  response: {
    200: {
      type: 'object',
      required: ['status', 'data'],
      properties: {
        status: { type: 'string', const: 'success' },
        data: {
          type: 'object',
          required: ['invites', 'pagination'],
          properties: {
            invites: {
              type: 'array',
              items: inviteResponseSchema,
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
        },
      },
    },
    401: errorResponseSchema,
    403: errorResponseSchema,
  },
};

// GET /api/invites/validate/:token - Validar token
export const validateTokenSchema: FastifySchema = {
  params: tokenParamSchema,
  response: {
    200: {
      type: 'object',
      required: ['status', 'data'],
      properties: {
        status: { type: 'string', const: 'success' },
        data: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            invite: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                roleToAssign: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
    400: errorResponseSchema,
  },
};

// POST /api/invites/accept - Aceitar convite
export const acceptInviteSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['token', 'name', 'password'],
    properties: {
      token: {
        type: 'string',
        minLength: 1,
      },
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 255,
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      required: ['status', 'message', 'data'],
      properties: {
        status: { type: 'string', const: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
    400: errorResponseSchema,
    409: errorResponseSchema,
    422: errorResponseSchema,
  },
};

// GET /api/invites/:id - Buscar convite por ID
export const getInviteSchema: FastifySchema = {
  params: idParamSchema,
  response: {
    200: {
      type: 'object',
      required: ['status', 'data'],
      properties: {
        status: { type: 'string', const: 'success' },
        data: {
          type: 'object',
          properties: {
            invite: inviteResponseSchema,
          },
        },
      },
    },
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
  },
};

// DELETE /api/invites/:id - Revogar convite
export const revokeInviteSchema: FastifySchema = {
  params: idParamSchema,
  response: {
    200: {
      type: 'object',
      required: ['status', 'message'],
      properties: {
        status: { type: 'string', const: 'success' },
        message: { type: 'string' },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
  },
};

// POST /api/invites/:id/resend - Reenviar convite
export const resendInviteSchema: FastifySchema = {
  params: idParamSchema,
  response: {
    200: {
      type: 'object',
      required: ['status', 'message', 'data'],
      properties: {
        status: { type: 'string', const: 'success' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            invite: inviteResponseSchema,
            inviteUrl: { type: 'string' },
          },
        },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
  },
};
