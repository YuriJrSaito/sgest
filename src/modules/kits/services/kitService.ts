import kitRepository from '../repositories/kitRepository';
import kitItemRepository from '../repositories/kitItemRepository';
import productRepository from '../../product/repositories/productRepository';
import userRepository from '../../auth/repositories/userRepository';
import notificationService from '../../notifications/services/notificationService';
import {
  Kit,
  KitWithDetails,
  KitItem,
  KitItemWithProduct,
  KitStatus,
  CreateKitDTO,
  UpdateKitDTO,
  AddKitItemDTO,
  KitListParams,
  PaginatedResponse,
} from '../../../types';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} from '../../../utils/errors';
import { hasPermission, LegacyPermissionMap } from '../../../utils/permissionUtils';
import type { AuthenticatedUser } from '../../../types/auth';
import { createModuleLogger } from '../../../config/logger';
import { runInTransaction } from '../../../infrastructure/transaction/runInTransaction';

const logger = createModuleLogger('kits');

// Transicoes de status permitidas
const ALLOWED_TRANSITIONS: Record<KitStatus, KitStatus[]> = {
  draft: ['assembling'],
  assembling: ['draft', 'delivered'],
  delivered: ['returned'],
  returned: ['draft'],
};

const LEGACY_KIT_PERMISSIONS: LegacyPermissionMap = {
  GERENTE: ['kits:read', 'kits:assign'],
  RESELLER: ['kits:read:own'],
};

class KitService {
  private canReadAnyKit(user: AuthenticatedUser): boolean {
    return hasPermission(user, 'kits:read', LEGACY_KIT_PERMISSIONS);
  }

  private canReadOwnKit(user: AuthenticatedUser): boolean {
    return hasPermission(user, 'kits:read:own', LEGACY_KIT_PERMISSIONS);
  }

  /**
   * Cria um novo kit
   */
  async create(data: CreateKitDTO, user: AuthenticatedUser): Promise<Kit> {
    if (!hasPermission(user, 'kits:create', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para criar kits');
    }

    return runInTransaction(async (client) => {
      const code = await kitRepository.generateCode(client);
      return kitRepository.create({
        code,
        name: data.name,
        description: data.description,
        createdBy: user.id,
      }, client);
    });
  }

  /**
   * Lista kits com filtros
   */
  async list(params: KitListParams, user: AuthenticatedUser): Promise<PaginatedResponse<KitWithDetails>> {
    if (this.canReadAnyKit(user)) {
      return kitRepository.findAll(params);
    }

    if (this.canReadOwnKit(user)) {
      params.resellerId = user.id;
      return kitRepository.findAll(params);
    }

    throw new ForbiddenError('Voce nao tem permissao para visualizar kits');
  }

  /**
   * Busca kit por ID com detalhes
   */
  async findById(id: string, user: AuthenticatedUser): Promise<KitWithDetails> {
    const kit = await kitRepository.findByIdWithDetails(id);

    if (this.canReadAnyKit(user)) {
      return kit;
    }

    if (this.canReadOwnKit(user) && kit.reseller_id === user.id) {
      return kit;
    }

    if (!this.canReadOwnKit(user)) {
      throw new ForbiddenError('Acesso negado');
    }

    throw new ForbiddenError('Voce pode visualizar apenas kits atribuidos a voce');
  }

  /**
   * Atualiza dados basicos do kit
   */
  async update(id: string, data: UpdateKitDTO, user: AuthenticatedUser): Promise<Kit> {
    if (!hasPermission(user, 'kits:update', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para atualizar kits');
    }

    await kitRepository.findById(id);
    return kitRepository.update(id, data);
  }

  /**
   * Deleta kit (apenas draft)
   */
  async delete(id: string, user: AuthenticatedUser): Promise<void> {
    if (!hasPermission(user, 'kits:delete', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para deletar kits');
    }

    const kit = await kitRepository.findById(id);
    if (kit.status !== 'draft') {
      throw new ValidationError('Apenas kits em rascunho podem ser deletados');
    }

    const deleted = await kitRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('Kit nao encontrado');
    }
  }

  /**
   * Muda o status do kit com regras de negocio
   */
  async updateStatus(id: string, newStatus: KitStatus, user: AuthenticatedUser): Promise<Kit> {
    if (!hasPermission(user, 'kits:update', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para alterar status');
    }

    return runInTransaction(async (client) => {
      const kit = await kitRepository.findByIdForUpdate(id, client);
      if (!kit) {
        throw new NotFoundError('Kit nao encontrado');
      }

      // Validar transicao
      const allowed = ALLOWED_TRANSITIONS[kit.status];
      if (!allowed || !allowed.includes(newStatus)) {
        throw new ValidationError(
          `Transicao de "${kit.status}" para "${newStatus}" nao e permitida`
        );
      }

      const items = await kitItemRepository.findRawByKitId(id, client);

      // Regras por transicao
      if (newStatus === 'assembling') {
        // draft → assembling: precisa ter itens, reduz estoque
        if (items.length === 0) {
          throw new ValidationError('Kit precisa ter pelo menos 1 item para iniciar montagem');
        }
        for (const item of items) {
          await productRepository.adjustStock(item.product_id, -item.quantity, client);
        }
      }

      if (newStatus === 'delivered') {
        // assembling → delivered: precisa ter revendedor
        if (!kit.reseller_id) {
          throw new ValidationError('Kit precisa estar atribuido a um revendedor para ser entregue');
        }

        // Notificar revendedor
        notificationService.notifyUser(kit.reseller_id, {
          type: 'system',
          title: 'Kit entregue',
          message: `O kit ${kit.code} - ${kit.name} foi marcado como entregue`,
          data: { kitId: kit.id, kitCode: kit.code },
        }).catch((err) => {
          logger.warn({ err, kitId: kit.id, userId: kit.reseller_id }, 'Notification failed');
        });
      }

      if (newStatus === 'returned') {
        // delivered → returned: devolve estoque
        for (const item of items) {
          await productRepository.adjustStock(item.product_id, item.quantity, client);
        }

        // Notificar admins
        notificationService.notifyAdmins({
          type: 'system',
          title: 'Kit devolvido',
          message: `O kit ${kit.code} - ${kit.name} foi devolvido`,
          data: { kitId: kit.id, kitCode: kit.code },
        }).catch((err) => {
          logger.warn({ err, kitId: kit.id }, 'Notification failed');
        });
      }

      if (newStatus === 'draft' && kit.status === 'assembling') {
        // assembling → draft (cancelar): devolve estoque
        for (const item of items) {
          await productRepository.adjustStock(item.product_id, item.quantity, client);
        }
      }

      return kitRepository.updateStatus(id, newStatus, client);
    });
  }

  /**
   * Atribui kit a um revendedor
   */
  async assign(id: string, resellerId: string, user: AuthenticatedUser): Promise<Kit> {
    if (!hasPermission(user, 'kits:assign', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para atribuir kits');
    }

    const kit = await kitRepository.findById(id);
    if (kit.status !== 'draft' && kit.status !== 'assembling') {
      throw new ValidationError('Kit so pode ser atribuido nos status "draft" ou "assembling"');
    }

    // Verificar revendedor
    const reseller = await userRepository.findByIdOrNull(resellerId);
    if (!reseller || reseller.status !== 'ACTIVE') {
      throw new ValidationError('Revendedor nao encontrado ou inativo');
    }

    const updated = await kitRepository.assign(id, resellerId);

    // Notificar revendedor
    notificationService.notifyUser(resellerId, {
      type: 'system',
      title: 'Kit atribuido',
      message: `O kit ${kit.code} - ${kit.name} foi atribuido a voce`,
      data: { kitId: kit.id, kitCode: kit.code },
    }).catch((err) => {
      logger.warn({ err, kitId: kit.id, userId: resellerId }, 'Notification failed');
    });

    return updated;
  }

  /**
   * Remove revendedor do kit
   */
  async unassign(id: string, user: AuthenticatedUser): Promise<Kit> {
    if (!hasPermission(user, 'kits:assign', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para desatribuir kits');
    }

    const kit = await kitRepository.findById(id);
    if (kit.status === 'delivered') {
      throw new ValidationError('Kit entregue nao pode ser desatribuido');
    }

    return kitRepository.unassign(id);
  }

  // ==========================================
  // ITEMS
  // ==========================================

  /**
   * Lista itens de um kit
   */
  async listItems(kitId: string, user: AuthenticatedUser): Promise<KitItemWithProduct[]> {
    const kit = await kitRepository.findById(kitId);

    if (this.canReadAnyKit(user)) {
      return kitItemRepository.findByKitId(kitId);
    }

    if (!(this.canReadOwnKit(user) && kit.reseller_id === user.id)) {
      throw new ForbiddenError('Acesso negado');
    }

    return kitItemRepository.findByKitId(kitId);
  }

  /**
   * Adiciona item ao kit (apenas draft)
   */
  async addItem(kitId: string, data: AddKitItemDTO, user: AuthenticatedUser): Promise<KitItem> {
    if (!hasPermission(user, 'kits:update', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para adicionar itens');
    }

    const kit = await kitRepository.findById(kitId);
    if (kit.status !== 'draft') {
      throw new ValidationError('Itens so podem ser adicionados em kits com status "draft"');
    }

    // Verificar produto existe e tem estoque
    const product = await productRepository.findById(data.productId);
    const existingItem = await kitItemRepository.findByKitIdAndProductId(kitId, data.productId);
    const totalQuantity = (existingItem?.quantity || 0) + data.quantity;

    if (product.stock < totalQuantity) {
      throw new ValidationError(
        `Estoque insuficiente para "${product.name}". Disponivel: ${product.stock}, Solicitado: ${totalQuantity}`
      );
    }

    if (existingItem) {
      return kitItemRepository.updateQuantity(existingItem.id, totalQuantity);
    }

    return kitItemRepository.create({
      kitId,
      productId: data.productId,
      quantity: data.quantity,
      unitPrice: product.price,
    });
  }

  /**
   * Atualiza quantidade de um item (apenas draft)
   */
  async updateItem(itemId: string, quantity: number, user: AuthenticatedUser): Promise<KitItem> {
    if (!hasPermission(user, 'kits:update', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para atualizar itens');
    }

    if (quantity <= 0) {
      throw new ValidationError('Quantidade deve ser maior que zero');
    }

    const item = await kitItemRepository.findById(itemId);
    const kit = await kitRepository.findById(item.kit_id);

    if (kit.status !== 'draft') {
      throw new ValidationError('Itens so podem ser alterados em kits com status "draft"');
    }

    // Verificar estoque disponivel
    const product = await productRepository.findById(item.product_id);
    if (product.stock < quantity) {
      throw new ValidationError(
        `Estoque insuficiente para "${product.name}". Disponivel: ${product.stock}, Solicitado: ${quantity}`
      );
    }

    return kitItemRepository.updateQuantity(itemId, quantity);
  }

  /**
   * Remove item do kit (apenas draft)
   */
  async removeItem(itemId: string, user: AuthenticatedUser): Promise<void> {
    if (!hasPermission(user, 'kits:update', LEGACY_KIT_PERMISSIONS)) {
      throw new ForbiddenError('Voce nao tem permissao para remover itens');
    }

    const item = await kitItemRepository.findById(itemId);
    const kit = await kitRepository.findById(item.kit_id);

    if (kit.status !== 'draft') {
      throw new ValidationError('Itens so podem ser removidos de kits com status "draft"');
    }

    await kitItemRepository.delete(itemId);
  }
}

export default new KitService();
