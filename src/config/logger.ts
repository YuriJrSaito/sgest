import pino, { Logger, LoggerOptions } from "pino";
import { FastifyBaseLogger } from "fastify";
import { env } from "./env";

// Tipo compativel com Fastify e Pino (ambos suportam child)
type AppLogger = Logger | FastifyBaseLogger;

const isDevelopment = env.NODE_ENV === "development";
const isTest = env.NODE_ENV === "test";

// Configuracao exportada para uso no Fastify
export const loggerConfig: LoggerOptions = {
  level: isTest ? "silent" : isDevelopment ? "debug" : "info",

  // Formatacao pretty apenas em desenvolvimento
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Campos base incluidos em todos os logs
  base: {
    env: env.NODE_ENV,
  },

  // Serializers customizados para dados sensiveis
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },

  // Redact para ocultar dados sensiveis
  redact: {
    paths: [
      "password",
      "passwordHash",
      "password_hash",
      "accessToken",
      "refreshToken",
      "token",
      "authorization",
      "cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
};

// Logger singleton - inicializado com instancia standalone,
// depois substituido pelo logger do Fastify via setLogger()
let logger: AppLogger = pino(loggerConfig);

/**
 * Define o logger principal (chamado pelo server.ts apos criar Fastify)
 */
export function setLogger(fastifyLogger: AppLogger): void {
  logger = fastifyLogger;
}

/**
 * Retorna o logger principal
 */
export function getLogger(): AppLogger {
  return logger;
}

/**
 * Cria child logger para um modulo especifico
 */
export function createModuleLogger(moduleName: string): AppLogger {
  return logger.child({ module: moduleName });
}

// Getters para child loggers (criados sob demanda para usar logger atualizado)
export const getAuthLogger = (): AppLogger => logger.child({ module: "auth" });
export const getDbLogger = (): AppLogger => logger.child({ module: "database" });
export const getHttpLogger = (): AppLogger => logger.child({ module: "http" });

export default logger;
