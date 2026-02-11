import type { PoolClient } from "pg";
import database from "../../config/database";

export async function runInTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  return database.transaction(callback);
}
