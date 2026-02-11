// src/__tests__/unit/kitService.test.ts
import kitService from '../../modules/kits/services/kitService';
import kitRepository from '../../modules/kits/repositories/kitRepository';
import kitItemRepository from '../../modules/kits/repositories/kitItemRepository';
import productRepository from '../../modules/product/repositories/productRepository';
import userRepository from '../../modules/auth/repositories/userRepository';
import notificationService from '../../modules/notifications/services/notificationService';
import database from '../../config/database';
import { ForbiddenError, ValidationError } from '../../utils/errors';
import { KitStatus } from '../../types';

jest.mock('../../modules/kits/repositories/kitRepository');
jest.mock('../../modules/kits/repositories/kitItemRepository');
jest.mock('../../modules/product/repositories/productRepository');
jest.mock('../../modules/auth/repositories/userRepository');
jest.mock('../../modules/notifications/services/notificationService');
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: any) => cb({ query: jest.fn() })),
    query: jest.fn(),
  },
}));

describe('KitService Unit Tests', () => {
  const adminUser = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' as const };
  const resellerUser = { id: 'reseller-1', email: 'reseller@test.com', role: 'RESELLER' as const };

  beforeEach(() => {
    jest.clearAllMocks();
    (notificationService.notifyUser as jest.Mock).mockResolvedValue(undefined);
    (notificationService.notifyAdmins as jest.Mock).mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('deve impedir criacao por nao-admin', async () => {
      await expect(
        kitService.create({ name: 'Kit Teste' }, resellerUser)
      ).rejects.toThrow(ForbiddenError);

      expect(kitRepository.generateCode).not.toHaveBeenCalled();
    });

    it('deve criar kit com sucesso para admin', async () => {
      const mockKit = {
        id: 'kit-1',
        code: 'KIT-001',
        name: 'Kit Teste',
        description: 'Descricao',
        status: 'draft' as KitStatus,
        reseller_id: null,
        assigned_at: null,
        returned_at: null,
        notes: null,
        created_by: adminUser.id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (kitRepository.generateCode as jest.Mock).mockResolvedValue('KIT-001');
      (kitRepository.create as jest.Mock).mockResolvedValue(mockKit);

      const result = await kitService.create(
        { name: 'Kit Teste', description: 'Descricao' },
        adminUser
      );

      expect(kitRepository.generateCode).toHaveBeenCalledWith(expect.any(Object));
      expect(kitRepository.create).toHaveBeenCalledWith(
        {
          code: 'KIT-001',
          name: 'Kit Teste',
          description: 'Descricao',
          createdBy: adminUser.id,
        },
        expect.any(Object)
      );
      expect(result).toEqual(mockKit);
    });
  });

  describe('list', () => {
    it('deve listar todos os kits para admin', async () => {
      const response = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      (kitRepository.findAll as jest.Mock).mockResolvedValue(response);

      const result = await kitService.list({ status: 'draft' }, adminUser);

      expect(kitRepository.findAll).toHaveBeenCalledWith({ status: 'draft' });
      expect(result).toEqual(response);
    });

    it('deve filtrar kits por revendedor para usuario reseller', async () => {
      const response = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      (kitRepository.findAll as jest.Mock).mockResolvedValue(response);

      const params = { page: 1 };
      await kitService.list(params, resellerUser);

      expect(kitRepository.findAll).toHaveBeenCalledWith({ page: 1, resellerId: resellerUser.id });
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      (database.transaction as jest.Mock).mockImplementation(async (cb: any) => cb({ query: jest.fn() }));
    });

    it('deve bloquear transicao invalida', async () => {
      (kitRepository.findByIdForUpdate as jest.Mock).mockResolvedValue({
        id: 'kit-1',
        status: 'draft',
        reseller_id: null,
      });

      await expect(
        kitService.updateStatus('kit-1', 'delivered', adminUser)
      ).rejects.toThrow(ValidationError);

      expect(kitRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('deve exigir itens ao iniciar montagem', async () => {
      (kitRepository.findByIdForUpdate as jest.Mock).mockResolvedValue({
        id: 'kit-1',
        status: 'draft',
        reseller_id: null,
      });
      (kitItemRepository.findRawByKitId as jest.Mock).mockResolvedValue([]);

      await expect(
        kitService.updateStatus('kit-1', 'assembling', adminUser)
      ).rejects.toThrow(ValidationError);

      expect(productRepository.adjustStock).not.toHaveBeenCalled();
    });

    it('deve reduzir estoque ao mudar para assembling', async () => {
      const kit = { id: 'kit-1', status: 'draft', reseller_id: null };
      const items = [
        { product_id: 'prod-1', quantity: 2 },
        { product_id: 'prod-2', quantity: 1 },
      ];

      (kitRepository.findByIdForUpdate as jest.Mock).mockResolvedValue(kit);
      (kitItemRepository.findRawByKitId as jest.Mock).mockResolvedValue(items);
      (productRepository.adjustStock as jest.Mock).mockResolvedValue({});
      (kitRepository.updateStatus as jest.Mock).mockResolvedValue({ ...kit, status: 'assembling' });

      const result = await kitService.updateStatus('kit-1', 'assembling', adminUser);

      expect(productRepository.adjustStock).toHaveBeenCalledWith('prod-1', -2, expect.any(Object));
      expect(productRepository.adjustStock).toHaveBeenCalledWith('prod-2', -1, expect.any(Object));
      expect(kitRepository.updateStatus).toHaveBeenCalledWith('kit-1', 'assembling', expect.any(Object));
      expect(result.status).toBe('assembling');
    });

    it('deve bloquear entrega sem revendedor atribuido', async () => {
      const kit = { id: 'kit-1', status: 'assembling', reseller_id: null };
      (kitRepository.findByIdForUpdate as jest.Mock).mockResolvedValue(kit);
      (kitItemRepository.findRawByKitId as jest.Mock).mockResolvedValue([{ product_id: 'prod-1', quantity: 1 }]);

      await expect(
        kitService.updateStatus('kit-1', 'delivered', adminUser)
      ).rejects.toThrow(ValidationError);
    });

    it('deve devolver estoque ao marcar como returned', async () => {
      const kit = { id: 'kit-1', status: 'delivered', reseller_id: 'reseller-1' };
      (kitRepository.findByIdForUpdate as jest.Mock).mockResolvedValue(kit);
      (kitItemRepository.findRawByKitId as jest.Mock).mockResolvedValue([
        { product_id: 'prod-1', quantity: 3 },
      ]);
      (productRepository.adjustStock as jest.Mock).mockResolvedValue({});
      (kitRepository.updateStatus as jest.Mock).mockResolvedValue({ ...kit, status: 'returned' });

      const result = await kitService.updateStatus('kit-1', 'returned', adminUser);

      expect(productRepository.adjustStock).toHaveBeenCalledWith('prod-1', 3, expect.any(Object));
      expect(kitRepository.updateStatus).toHaveBeenCalledWith('kit-1', 'returned', expect.any(Object));
      expect(result.status).toBe('returned');
    });
  });

  describe('assign/unassign', () => {
    it('deve impedir atribuicao por nao-admin', async () => {
      await expect(
        kitService.assign('kit-1', 'reseller-1', resellerUser)
      ).rejects.toThrow(ForbiddenError);
    });

    it('deve atribuir kit com sucesso', async () => {
      const kit = { id: 'kit-1', status: 'draft', reseller_id: null, code: 'KIT-001', name: 'Kit' };
      (kitRepository.findById as jest.Mock).mockResolvedValue(kit);
      (userRepository.findByIdOrNull as jest.Mock).mockResolvedValue({
        id: 'reseller-1',
        status: 'ACTIVE',
      });
      (kitRepository.assign as jest.Mock).mockResolvedValue({ ...kit, reseller_id: 'reseller-1' });

      const result = await kitService.assign('kit-1', 'reseller-1', adminUser);

      expect(kitRepository.assign).toHaveBeenCalledWith('kit-1', 'reseller-1');
      expect(notificationService.notifyUser).toHaveBeenCalledWith('reseller-1', expect.any(Object));
      expect(result.reseller_id).toBe('reseller-1');
    });

    it('deve impedir desatribuicao se status for delivered', async () => {
      (kitRepository.findById as jest.Mock).mockResolvedValue({ id: 'kit-1', status: 'delivered' });

      await expect(
        kitService.unassign('kit-1', adminUser)
      ).rejects.toThrow(ValidationError);
    });

    it('deve desatribuir kit com sucesso', async () => {
      (kitRepository.findById as jest.Mock).mockResolvedValue({ id: 'kit-1', status: 'draft' });
      (kitRepository.unassign as jest.Mock).mockResolvedValue({ id: 'kit-1', reseller_id: null });

      const result = await kitService.unassign('kit-1', adminUser);

      expect(kitRepository.unassign).toHaveBeenCalledWith('kit-1');
      expect(result.reseller_id).toBeNull();
    });
  });

  describe('items', () => {
    it('deve bloquear listagem para reseller nao atribuido', async () => {
      (kitRepository.findById as jest.Mock).mockResolvedValue({
        id: 'kit-1',
        reseller_id: 'another',
      });

      await expect(
        kitService.listItems('kit-1', resellerUser)
      ).rejects.toThrow(ForbiddenError);
    });

    it('deve adicionar item ao kit em draft', async () => {
      (kitRepository.findById as jest.Mock).mockResolvedValue({ id: 'kit-1', status: 'draft' });
      (productRepository.findById as jest.Mock).mockResolvedValue({
        id: 'prod-1',
        stock: 10,
        price: 99.9,
        name: 'Produto',
      });
      (kitItemRepository.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      const result = await kitService.addItem('kit-1', { productId: 'prod-1', quantity: 2 }, adminUser);

      expect(kitItemRepository.create).toHaveBeenCalledWith({
        kitId: 'kit-1',
        productId: 'prod-1',
        quantity: 2,
        unitPrice: 99.9,
      });
      expect(result).toEqual({ id: 'item-1' });
    });

    it('deve bloquear adiciona item se kit nao for draft', async () => {
      (kitRepository.findById as jest.Mock).mockResolvedValue({ id: 'kit-1', status: 'assembling' });

      await expect(
        kitService.addItem('kit-1', { productId: 'prod-1', quantity: 1 }, adminUser)
      ).rejects.toThrow(ValidationError);
    });

    it('deve atualizar quantidade do item', async () => {
      (kitItemRepository.findById as jest.Mock).mockResolvedValue({ id: 'item-1', kit_id: 'kit-1', product_id: 'prod-1' });
      (kitRepository.findById as jest.Mock).mockResolvedValue({ id: 'kit-1', status: 'draft' });
      (productRepository.findById as jest.Mock).mockResolvedValue({ stock: 10, name: 'Produto' });
      (kitItemRepository.updateQuantity as jest.Mock).mockResolvedValue({ id: 'item-1', quantity: 3 });

      const result = await kitService.updateItem('item-1', 3, adminUser);

      expect(kitItemRepository.updateQuantity).toHaveBeenCalledWith('item-1', 3);
      expect(result).toEqual({ id: 'item-1', quantity: 3 });
    });

    it('deve remover item do kit', async () => {
      (kitItemRepository.findById as jest.Mock).mockResolvedValue({ id: 'item-1', kit_id: 'kit-1' });
      (kitRepository.findById as jest.Mock).mockResolvedValue({ id: 'kit-1', status: 'draft' });
      (kitItemRepository.delete as jest.Mock).mockResolvedValue(true);

      await kitService.removeItem('item-1', adminUser);

      expect(kitItemRepository.delete).toHaveBeenCalledWith('item-1');
    });
  });
});
