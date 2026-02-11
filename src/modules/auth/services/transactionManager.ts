// src/modules/auth/services/transactionManager.ts
import { runInTransaction } from "../../../infrastructure/transaction/runInTransaction";
import { TransactionContext } from "../types";
import { ITransactionManager } from "./interfaces/ITransactionManager";

class TransactionManager implements ITransactionManager {
  async transaction<T>(callback: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return runInTransaction((client) => callback(client as TransactionContext));
  }
}

export default new TransactionManager();
