import crypto from 'crypto';
import bcrypt from 'bcrypt';
import inviteRepository from '../repositories/inviteRepository';
import resellerProfileRepository from '../repositories/resellerProfileRepository';
import userRepository from '../../auth/repositories/userRepository';
import {
  Invite,
  InviteWithCreator,
  CreateInviteDTO,
  AcceptInviteDTO,
  InviteListParams,
  PaginatedResponse,
  User,
  UserRole,
} from '../../../types';
import {
  ConflictError,
  ValidationError,
  ForbiddenError,
} from '../../../utils/errors';
import notificationService from '../../notifications/services/notificationService';
import emailService from '../../email/services/emailService';
import { hasPermission } from '../../../utils/permissionUtils';
import type { AuthenticatedUser } from '../../../types/auth';
import { createModuleLogger } from '../../../config/logger';
import { runInTransaction } from '../../../infrastructure/transaction/runInTransaction';

const logger = createModuleLogger('invites');

// Configuracao de expiracao de convites (em horas)
const INVITE_EXPIRATION_HOURS = 48;
const PASSWORD_MIN_LENGTH = 8;
// Senha deve ter: 1 minúscula, 1 maiúscula, 1 dígito, 1 especial, mínimo 8 chars.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const USERS_EMAIL_UNIQUE_CONSTRAINT = 'users_email_key';

const isUserEmailUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code, constraint } = error as { code?: string; constraint?: string };
  if (code !== '23505') {
    return false;
  }

  return !constraint || constraint === USERS_EMAIL_UNIQUE_CONSTRAINT;
};

class InviteService {
  /**
   * Gera um token seguro para o convite
   */
  private generateToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Calcula data de expiracao do convite
   */
  private calculateExpirationDate(): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITE_EXPIRATION_HOURS);
    return expiresAt;
  }

  /**
   * Cria um novo convite
   * Apenas ADMIN pode criar convites
   */
  async create(data: CreateInviteDTO, user: AuthenticatedUser): Promise<Invite> {
    if (!hasPermission(user, 'invites:create')) {
      throw new ForbiddenError('Voce nao tem permissao para criar convites');
    }

    // Normalizar email
    const email = data.email.toLowerCase().trim();

    // Verificar se email ja esta cadastrado
    const existingUser = await userRepository.findByEmailOrNull(email);
    if (existingUser) {
      throw new ConflictError('Este email ja esta cadastrado no sistema');
    }

    // Gerar token e data de expiracao
    const token = this.generateToken();
    const expiresAt = this.calculateExpirationDate();

    const invite = await runInTransaction(async (client) => {
      // Evita concorrencia para o mesmo email
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email]);

      // Invalidar convites anteriores para o mesmo email
      await inviteRepository.invalidatePreviousInvites(email, client);

      // Criar convite
      return inviteRepository.create(
        {
          email,
          token,
          roleToAssign: data.roleToAssign,
          commissionRate: data.roleToAssign === 'RESELLER' ? data.commissionRate ?? null : null,
          expiresAt,
          createdBy: user.id,
        },
        client
      );
    });

    await emailService.sendInvite(email, token, user.email);

    // Notificar admins sobre novo convite
    notificationService.notifyAdmins({
      type: 'invite',
      title: 'Novo convite criado',
      message: `Convite enviado para ${email} com role ${data.roleToAssign}`,
      data: { inviteId: invite.id, email, roleToAssign: data.roleToAssign },
    }).catch((err) => {
      logger.warn({ err, inviteId: invite.id }, 'Notification failed');
    });

    return invite;
  }

  /**
   * Valida um token de convite
   * Retorna informacoes do convite se valido
   */
  async validateToken(token: string): Promise<{ valid: boolean; invite?: Invite; error?: string }> {
    const invite = await inviteRepository.findByTokenOrNull(token);

    if (!invite) {
      return { valid: false, error: 'Convite nao encontrado' };
    }

    if (invite.used_at) {
      return { valid: false, error: 'Este convite ja foi utilizado' };
    }

    if (new Date(invite.expires_at) < new Date()) {
      return { valid: false, error: 'Este convite expirou' };
    }

    return { valid: true, invite };
  }

  /**
   * Aceita um convite e cria o usuario
   */
  async accept(data: AcceptInviteDTO): Promise<User> {
    // Validar senha
    if (!data.password || data.password.length < PASSWORD_MIN_LENGTH || !PASSWORD_REGEX.test(data.password)) {
      throw new ValidationError(
        'Senha deve ter no minimo 8 caracteres e conter maiuscula, minuscula, numero e caractere especial'
      );
    }

    // Hash da senha antes da transacao
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Usar transacao para garantir atomicidade
    return runInTransaction(async (client) => {
      const invite = await inviteRepository.findByTokenForUpdate(data.token, client);

      if (!invite) {
        throw new ValidationError('Convite nao encontrado');
      }

      if (invite.used_at) {
        throw new ValidationError('Este convite ja foi utilizado');
      }

      if (new Date(invite.expires_at) < new Date()) {
        throw new ValidationError('Este convite expirou');
      }

      // Criar usuario
      let user: User;
      try {
        user = await userRepository.create(
          {
            name: data.name,
            email: invite.email,
            passwordHash,
            role: invite.role_to_assign as UserRole,
          },
          client
        );
      } catch (error) {
        if (isUserEmailUniqueViolation(error)) {
          throw new ConflictError('Este email ja esta cadastrado no sistema');
        }
        throw error;
      }

      // Se for RESELLER, criar perfil de revendedor
      if (invite.role_to_assign === 'RESELLER') {
        await resellerProfileRepository.create(
          {
            userId: user.id,
            commissionRate: invite.commission_rate ?? null,
          },
          client
        );
      }

      // Marcar convite como usado
      await client.query(
        'UPDATE invites SET used_at = NOW() WHERE id = $1',
        [invite.id]
      );

      // Notificar admins sobre novo usuario
      notificationService.notifyAdmins({
        type: 'reseller',
        title: 'Novo revendedor cadastrado',
        message: `${data.name} aceitou o convite e criou uma conta como ${invite.role_to_assign}`,
        data: { userId: user.id, name: data.name, role: invite.role_to_assign },
      }).catch((err) => {
        logger.warn({ err, userId: user.id }, 'Notification failed');
      });

      return user;
    });
  }

  /**
   * Lista convites com filtros
   * Apenas ADMIN pode listar
   */
  async list(params: InviteListParams, user: AuthenticatedUser): Promise<PaginatedResponse<InviteWithCreator>> {
    if (!hasPermission(user, 'invites:read')) {
      throw new ForbiddenError('Voce nao tem permissao para visualizar convites');
    }

    return inviteRepository.findAll(params);
  }

  /**
   * Busca convite por ID
   */
  async findById(id: string, user: AuthenticatedUser): Promise<Invite> {
    if (!hasPermission(user, 'invites:read')) {
      throw new ForbiddenError('Voce nao tem permissao para visualizar convites');
    }

    return inviteRepository.findById(id);
  }

  /**
   * Revoga um convite (remove)
   */
  async revoke(id: string, user: AuthenticatedUser): Promise<void> {
    if (!hasPermission(user, 'invites:delete')) {
      throw new ForbiddenError('Voce nao tem permissao para revogar convites');
    }

    const invite = await inviteRepository.findById(id);

    if (invite.used_at) {
      throw new ValidationError('Nao e possivel revogar um convite ja utilizado');
    }

    await inviteRepository.delete(id);
  }

  /**
   * Reenvia um convite (gera novo token e expiracao)
   */
  async resend(id: string, user: AuthenticatedUser): Promise<Invite> {
    if (!hasPermission(user, 'invites:create')) {
      throw new ForbiddenError('Voce nao tem permissao para reenviar convites');
    }

    const invite = await inviteRepository.findById(id);

    if (invite.used_at) {
      throw new ValidationError('Nao e possivel reenviar um convite ja utilizado');
    }

    // Gerar novo token e expiracao
    const token = this.generateToken();
    const expiresAt = this.calculateExpirationDate();

    const updatedInvite = await inviteRepository.updateToken(id, token, expiresAt);

    await emailService.sendInvite(invite.email, token, user.email);

    return updatedInvite;
  }

  /**
   * Remove convites expirados
   * Chamado pelo scheduler de cleanup
   */
  async cleanupExpired(): Promise<number> {
    return inviteRepository.deleteExpired();
  }
}

export default new InviteService();
