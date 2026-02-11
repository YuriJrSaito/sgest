// src/__tests__/globalSetup.ts
// Executa uma vez antes de todos os testes para configurar o banco de dados de teste

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Carregar variaveis de ambiente de teste
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

export default async function globalSetup() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'sgest_test',
  });
  const MIGRATION_LOCK_KEY = 987654321;
  let client: import('pg').PoolClient | undefined;

  try {
    console.log('Configurando banco de dados de teste...');
    client = await pool.connect();

    // Serializa migrations entre processos de teste para evitar deadlock
    // quando dois setups tentam criar objetos simultaneamente.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    // Garantir que uuid-ossp extension existe
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Ler e executar os scripts SQL na ordem
    const sqlDir = path.resolve(__dirname, '../../docker-init');
    const files = fs
      .readdirSync(sqlDir)
      .filter((f) => f.endsWith('.sql') && f !== '01-init.sql') // Pular criacao de DB
      .sort();

    for (const file of files) {
      const filePath = path.join(sqlDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        console.log(`  [ok] Executado: ${file}`);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        // Ignorar erros comuns de re-execucao
        if (
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate key') ||
          (errorMessage.includes('relation') && errorMessage.includes('does not exist'))
        ) {
          console.log(`  [skip] Pulado (ja existe): ${file}`);
        } else {
          console.warn(`  [warn] Aviso em ${file}:`, errorMessage);
        }
      }
    }

    console.log('Banco de dados de teste configurado!');
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'ECONNREFUSED') {
      console.warn('Banco de dados nao disponivel - pulando setup (testes unitarios nao precisam de DB)');
      return;
    }

    console.error('Erro ao configurar banco de teste:', err);
    throw err;
  } finally {
    if (client) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      } catch (_err) {
        // Ignorar erro de unlock em teardown
      } finally {
        client.release();
      }
    }
    await pool.end();
  }
}
