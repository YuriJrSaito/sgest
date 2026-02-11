// src/modules/auth/services/interfaces/ITransactionManager.ts

import { TransactionContext } from "../../types";

export interface ITransactionManager {
  transaction<T>(callback: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
