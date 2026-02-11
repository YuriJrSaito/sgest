// src/modules/auth/useCases/sessions/GetSessionsUseCase.ts
// Caso de uso: Listar sessoes ativas do usuario

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { GetSessionsInput, SessionOutput } from "./SessionsDTO";
import { RefreshTokenRepository } from "../../repositories/refreshTokenRepository";
import { hashToken } from "../../../../utils/tokenUtils";

@injectable()
export class GetSessionsUseCase {
  constructor(@inject(AUTH_TOKENS.RefreshTokenRepository) private refreshTokenRepository: RefreshTokenRepository) {}

  async execute(input: GetSessionsInput): Promise<SessionOutput[]> {
    const tokens = await this.refreshTokenRepository.findActiveByUserId(input.userId);
    const currentHash = input.currentRefreshToken
      ? hashToken(input.currentRefreshToken)
      : null;

    return tokens.map((token) => ({
      id: token.id,
      user_agent: token.user_agent,
      ip_address: token.ip_address,
      last_activity: token.created_at,
      created_at: token.created_at,
      is_current: currentHash ? token.token_hash === currentHash : false,
    }));
  }
}
