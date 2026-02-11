// src/modules/auth/useCases/profile/GetProfileUseCase.ts
// Caso de uso: Obter perfil do usuario

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { GetProfileInput, ProfileOutput } from "./ProfileDTO";
import { UserRepository } from "../../repositories/userRepository";
import { PermissionRepository } from "../../../permissions/repositories/permissionRepository";

@injectable()
export class GetProfileUseCase {
  constructor(
    @inject(AUTH_TOKENS.UserRepository) private userRepository: UserRepository,
    @inject(AUTH_TOKENS.PermissionRepository) private permissionRepository: PermissionRepository
  ) {}

  async execute(input: GetProfileInput): Promise<ProfileOutput> {
    const user = await this.userRepository.findById(input.userId);
    const permissions = await this.permissionRepository.findCodesByRoleCode(user.role);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
