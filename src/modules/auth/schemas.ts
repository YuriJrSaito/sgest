import { FastifySchema } from 'fastify';

// ==========================================
// SCHEMAS REUTILIZÁVEIS (BASE)
// ==========================================

// Schema reutilizável para respostas de erro (JSend pattern)
// Nota: Não definimos required nos items de errors porque o formato
// pode variar entre erros de validação do Fastify e erros customizados
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

// ==========================================
// CONSTANTES E PADRÕES (REGEX)
// ==========================================

// Regex para validar força da senha:
// - Mínimo 8 caracteres
// - Pelo menos 1 letra maiúscula
// - Pelo menos 1 letra minúscula
// - Pelo menos 1 número
// - Pelo menos 1 caractere especial
const PASSWORD_PATTERN = '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$';

// Schema do objeto user para respostas
const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['ADMIN', 'GERENTE', 'RESELLER'] },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    permissions: {
      type: 'array',
      items: { type: 'string' },
    },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

// Helper para criar schemas de resposta padronizados (JSend pattern)
// Gera schemas 200/201 para fast-json-stringify (performance)
const buildSuccessResponse = (dataSchema: object) => ({
  200: {
    type: 'object',
    required: ['status', 'data'],
    properties: {
      status: { type: 'string', const: 'success' },
      message: { type: 'string' },
      data: dataSchema,
    },
  },
  201: {
    type: 'object',
    required: ['status', 'data'],
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
  429: errorResponseSchema,
  500: errorResponseSchema,
});

// ==========================================
// SCHEMAS DAS ROTAS
// ==========================================

export const loginSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255
      },
      password: {
        type: 'string',
        maxLength: 100
      },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['user', 'accessToken', 'expiresIn'],
    properties: {
      user: userResponseSchema,
      accessToken: { type: 'string' },
      expiresIn: { type: 'string' },
    },
  }),
};

export const updateProfileSchema: FastifySchema = {
  body: {
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 255,
        pattern: '.*\\S.*',
      },
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255
      },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['user'],
    properties: {
      user: userResponseSchema,
    },
  }),
};

export const changePasswordSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: {
        type: 'string',
        maxLength: 100
      },
      newPassword: {
        type: 'string',
        minLength: 8,
        maxLength: 100,
        pattern: PASSWORD_PATTERN,
      },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
  }),
};

// refreshToken agora é lido do cookie HttpOnly, não do body
export const refreshTokenSchema: FastifySchema = {
  response: buildSuccessResponse({
    type: 'object',
    required: ['accessToken', 'expiresIn', 'user'],
    properties: {
      accessToken: { type: 'string' },
      expiresIn: { type: 'string' },
      user: userResponseSchema,
    },
  }),
};

// Schema para rota GET /api/auth/profile (retorna apenas user)
export const profileSchema: FastifySchema = {
  response: buildSuccessResponse({
    type: 'object',
    required: ['user'],
    properties: {
      user: userResponseSchema,
    },
  }),
};

// Schema de paginação reutilizável
const paginationQuerySchema = {
  page: { type: 'integer', default: 1, minimum: 1 },
  limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
};

// Schema para logout (retorna apenas mensagem)
export const logoutSchema: FastifySchema = {
  response: buildSuccessResponse({
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
  }),
};

// Schema para listar sessões ativas
export const sessionsSchema: FastifySchema = {
  response: buildSuccessResponse({
    type: 'object',
    required: ['sessions'],
    properties: {
      sessions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_agent: { type: 'string' },
            ip_address: { type: 'string' },
            last_activity: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' },
            is_current: { type: 'boolean' },
          },
        },
      },
    },
  }),
};

// Schema para revogar sessão específica
export const revokeSessionSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', format: 'uuid' },
    },
  },
  response: buildSuccessResponse({
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
  }),
};

// Schema para histórico de login
export const loginHistorySchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: paginationQuerySchema,
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['logs', 'pagination'],
    properties: {
      logs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            action: { type: 'string' },
            status: { type: 'string', enum: ['success', 'failure', 'blocked'] },
            resourceType: { type: 'string' },
            resourceId: { type: 'string' },
            ipAddress: { type: 'string' },
            userAgent: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
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

// Schema para histórico de auditoria geral
export const auditHistorySchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: paginationQuerySchema,
  },
  response: buildSuccessResponse({
    type: 'object',
    required: ['logs', 'pagination'],
    properties: {
      logs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            action: { type: 'string' },
            status: { type: 'string', enum: ['success', 'failure', 'blocked'] },
            resourceType: { type: 'string' },
            resourceId: { type: 'string' },
            ipAddress: { type: 'string' },
            userAgent: { type: 'string' },
            metadata: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
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

// Schema para estatísticas de auditoria
export const auditStatsSchema: FastifySchema = {
  response: buildSuccessResponse({
    type: 'object',
    required: ['stats'],
    properties: {
      stats: {
        type: 'object',
        properties: {
          totalLogins: { type: 'integer' },
          failedLogins: { type: 'integer' },
          lastLogin: { type: 'string', format: 'date-time' },
          lastIpAddress: { type: 'string' },
        },
      },
    },
  }),
};
