import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from './env';
import { getDbLogger } from './logger';

class Database {
  private pool: Pool;
  private readonly connectionTimeoutMillis: number;
  private readonly retryDelayMillis: number;
  private readonly maxRetries: number;

  constructor() {
    this.connectionTimeoutMillis = Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000;
    this.retryDelayMillis = Number(process.env.DB_CONNECT_RETRY_DELAY_MS) || 250;
    this.maxRetries = Number(process.env.DB_CONNECT_MAX_RETRIES) || 1;

    this.pool = new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: this.connectionTimeoutMillis,
    });

    this.pool.on('error', (err) => {
      getDbLogger().fatal({ err }, 'Erro inesperado no pool de conexoes');
      process.exit(-1);
    });
  }

  // Retry de conexão
  async waitForConnection(retries = 10, delay = 1000): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        const client = await this.pool.connect();
        getDbLogger().info('Conectado ao PostgreSQL com sucesso');
        client.release();
        return;
      } catch (err) {
        getDbLogger().warn({ attempt: i + 1, delay }, 'Tentativa de conexao falhou');
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    getDbLogger().fatal({ retries }, 'Nao foi possivel conectar ao PostgreSQL');
    process.exit(1);
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    const start = Date.now();
    let attempt = 0;

    while (true) {
      try {
        const result = await this.pool.query<T>(text, params);
        const duration = Date.now() - start;
        getDbLogger().debug({ query: text.substring(0, 100), duration, rows: result.rowCount }, 'Query executada');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isConnectTimeout = message.includes('timeout exceeded when trying to connect');

        if (isConnectTimeout && attempt < this.maxRetries) {
          attempt += 1;
          getDbLogger().warn({ attempt, err }, 'Timeout ao conectar no PostgreSQL, tentando novamente');
          await new Promise((res) => setTimeout(res, this.retryDelayMillis));
          continue;
        }

        if (isConnectTimeout) {
          (err as Error & { statusCode?: number }).statusCode = 503;
        }

        getDbLogger().error({ query: text.substring(0, 100), err }, 'Erro na query');
        throw err;
      }
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('timeout exceeded when trying to connect')) {
        (err as Error & { statusCode?: number }).statusCode = 503;
      }
      throw err;
    }
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    getDbLogger().info('Pool de conexoes fechado');
  }
}

const database = new Database();
export default database;
