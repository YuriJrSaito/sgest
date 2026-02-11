import { FastifySchema } from 'fastify';

const notificationResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['system', 'invite', 'product', 'reseller'] },
    title: { type: 'string' },
    message: { type: 'string' },
    data: { type: 'object' },
    read: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const paginationSchema = {
  type: 'object',
  properties: {
    total: { type: 'integer' },
    page: { type: 'integer' },
    limit: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
};

export const listNotificationsSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', default: 1, minimum: 1 },
      limit: { type: 'integer', default: 20, minimum: 1, maximum: 50 },
      read: { type: 'boolean' },
      type: { type: 'string', enum: ['system', 'invite', 'product', 'reseller'] },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            notifications: { type: 'array', items: notificationResponseSchema },
            pagination: paginationSchema,
          },
        },
      },
    },
  },
};

export const unreadCountSchema: FastifySchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            count: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const markReadSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

export const markAllReadSchema: FastifySchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            count: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const markBatchReadSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['ids'],
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
        maxItems: 100,
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            count: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const deleteNotificationSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

export const broadcastSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['title', 'message'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      message: { type: 'string', minLength: 1, maxLength: 1000 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            count: { type: 'integer' },
          },
        },
      },
    },
  },
};
