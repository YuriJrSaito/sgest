// src/__tests__/unit/productService.test.ts
import productService from '../../modules/product/services/productService';
import productRepository from '../../modules/product/repositories/productRepository';
import { ForbiddenError, ConflictError, BadRequestError } from '../../utils/errors';
import { UserRole } from '../../types';

jest.mock('../../modules/product/repositories/productRepository');

describe('ProductService Unit Tests', () => {
  const adminUser = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' as UserRole };
  const resellerUser = { id: 'reseller-1', email: 'reseller@test.com', role: 'RESELLER' as UserRole };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve bloquear criacao para reseller', async () => {
    await expect(
      productService.create({ name: 'Produto', price: 10 }, resellerUser)
    ).rejects.toThrow(ForbiddenError);

    expect(productRepository.create).not.toHaveBeenCalled();
  });

  it('deve retornar conflito quando SKU ja existe', async () => {
    (productRepository.skuExists as jest.Mock).mockResolvedValue(true);

    await expect(
      productService.create({ name: 'Produto', price: 10, sku: 'SKU-1' }, adminUser)
    ).rejects.toThrow(ConflictError);
  });

  it('deve bloquear hard delete quando produto esta em kits', async () => {
    (productRepository.hasKitItems as jest.Mock).mockResolvedValue(true);

    await expect(productService.hardDelete('prod-1', adminUser)).rejects.toThrow(ConflictError);
    expect(productRepository.hardDelete).not.toHaveBeenCalled();
  });

  it('deve rejeitar estoque com valor nao inteiro', async () => {
    await expect(
      productService.updateStock('prod-1', 1.5 as number, adminUser)
    ).rejects.toThrow(BadRequestError);
  });

  it('deve bloquear listagem para reseller', async () => {
    await expect(productService.findAll({}, resellerUser)).rejects.toThrow(ForbiddenError);
  });
});
