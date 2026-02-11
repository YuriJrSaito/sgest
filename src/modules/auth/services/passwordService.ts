// src/modules/auth/services/passwordService.ts
// Servico responsavel por hash e comparacao de senhas

import bcrypt from "bcrypt";

const BCRYPT_SALT_ROUNDS = 10;

export class PasswordService {
  /**
   * Gera hash de senha usando bcrypt
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  /**
   * Compara senha com hash armazenado
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

const passwordService = new PasswordService();

export default passwordService;
