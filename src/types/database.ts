import type { QueryResult, QueryResultRow } from 'pg';

export type QueryExecutor = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<QueryResult<T>>;
};
