import Redis from 'ioredis';
import { FastifyReply } from 'fastify';
import { getDbLogger } from '../../../config/logger';
import { NOTIFICATION_CHANNEL } from '../services/notificationEmitter';

// Intervalo de keep-alive para manter conexoes SSE ativas.
const SSE_KEEP_ALIVE_MS = 30_000;

interface SSEConnection {
  reply: FastifyReply;
  keepAliveTimer: NodeJS.Timeout;
}

class SSEManager {
  private connections: Map<string, Set<SSEConnection>> = new Map();
  private subscriber: Redis | null = null;
  private initialized = false;

  /**
   * Inicializa o subscriber Redis para receber notificacoes
   */
  initialize(): void {
    if (this.initialized) return;

    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryStrategy: (times: number) => Math.min(times * 100, 30000),
      maxRetriesPerRequest: null as unknown as number,
    };

    this.subscriber = new Redis(redisConfig);

    this.subscriber.subscribe(NOTIFICATION_CHANNEL, (err) => {
      if (err) {
        getDbLogger().error({ err }, 'SSE: Erro ao subscribir no canal de notificacoes');
      } else {
        getDbLogger().info('SSE: Inscrito no canal de notificacoes');
      }
    });

    this.subscriber.on('message', (_channel: string, message: string) => {
      try {
        const { userId, notification } = JSON.parse(message);
        this.sendToUser(userId, notification);
      } catch (err) {
        getDbLogger().error({ err }, 'SSE: Erro ao processar mensagem do Redis');
      }
    });

    this.subscriber.on('error', (err) => {
      getDbLogger().error({ err }, 'SSE: Erro na conexao Redis subscriber');
    });

    this.initialized = true;
  }

  /**
   * Adiciona uma conexao SSE para um usuario
   */
  addConnection(userId: string, reply: FastifyReply): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    const keepAliveTimer = setInterval(() => {
      try {
        reply.raw.write(':keep-alive\n\n');
      } catch {
        this.removeConnection(userId, reply);
      }
    }, SSE_KEEP_ALIVE_MS);

    const connection: SSEConnection = { reply, keepAliveTimer };
    this.connections.get(userId)!.add(connection);

    getDbLogger().debug({ userId, totalConnections: this.connections.get(userId)!.size }, 'SSE: Conexao adicionada');
  }

  /**
   * Remove uma conexao SSE
   */
  removeConnection(userId: string, reply: FastifyReply): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    for (const conn of userConnections) {
      if (conn.reply === reply) {
        clearInterval(conn.keepAliveTimer);
        userConnections.delete(conn);
        break;
      }
    }

    if (userConnections.size === 0) {
      this.connections.delete(userId);
    }

    getDbLogger().debug({ userId }, 'SSE: Conexao removida');
  }

  /**
   * Envia dados para todas as conexoes de um usuario
   */
  private sendToUser(userId: string, data: unknown): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) return;

    const message = `event: notification\ndata: ${JSON.stringify(data)}\n\n`;

    for (const conn of userConnections) {
      try {
        conn.reply.raw.write(message);
      } catch {
        this.removeConnection(userId, conn.reply);
      }
    }
  }

  /**
   * Encerra todas as conexoes e o subscriber Redis
   */
  async shutdown(): Promise<void> {
    // Fechar todas as conexoes SSE
    for (const [, connections] of this.connections) {
      for (const conn of connections) {
        clearInterval(conn.keepAliveTimer);
        try {
          conn.reply.raw.end();
        } catch {
          // Conexao ja encerrada
        }
      }
      connections.clear();
    }
    this.connections.clear();

    // Fechar subscriber Redis
    if (this.subscriber) {
      await this.subscriber.unsubscribe(NOTIFICATION_CHANNEL);
      await this.subscriber.quit();
      this.subscriber = null;
    }

    this.initialized = false;
    getDbLogger().info('SSE: Manager encerrado');
  }

  /**
   * Retorna o numero total de conexoes ativas
   */
  getActiveConnectionCount(): number {
    let count = 0;
    for (const connections of this.connections.values()) {
      count += connections.size;
    }
    return count;
  }
}

const sseManager = new SSEManager();
export default sseManager;
