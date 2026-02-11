// src/modules/auth/useCases/profile/UpdateProfileUseCase.ts
// Caso de uso: Atualizar perfil do usuario

import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../tokens";
import { UpdateProfileInput, ProfileOutput } from "./ProfileDTO";
import { UserRepository } from "../../repositories/userRepository";
import { DomainConflictError } from "../../domain/errors/DomainErrors";
import { PermissionRepository } from "../../../permissions/repositories/permissionRepository";

@injectable()
export class UpdateProfileUseCase {
  constructor(
    @inject(AUTH_TOKENS.UserRepository) private userRepository: UserRepository,
    @inject(AUTH_TOKENS.PermissionRepository) private permissionRepository: PermissionRepository
  ) {}

  async execute(input: UpdateProfileInput): Promise<ProfileOutput> {
    const updateData: { name?: string; email?: string } = {};

    // 1. Preparar dados de atualizacao
    if (input.name) {
      updateData.name = input.name.trim();
    }

    if (input.email) {
      const normalizedEmail = input.email.toLowerCase().trim();

      // Verificar se email ja existe
      const emailExists = await this.userRepository.emailExists(
        normalizedEmail,
        input.userId
      );
      if (emailExists) {
        throw new DomainConflictError("Email ja esta em uso");
      }

      updateData.email = normalizedEmail;
    }

    // 2. Atualizar usuario
    const user = await this.userRepository.update(input.userId, updateData);

    // 3. Buscar permissoes
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
