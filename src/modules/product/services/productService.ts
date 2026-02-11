import productRepository from '../repositories/productRepository';
import {
  Product,
  CreateProductDTO,
  UpdateProductDTO,
  ProductListParams,
  PaginatedResponse,
  ProductStats,
} from '../../../types';
import { ForbiddenError, ConflictError, BadRequestError } from '../../../utils/errors';
import { hasPermission } from '../../../utils/permissionUtils';
import type { AuthenticatedUser } from '../../../types/auth';

const SKU_UNIQUE_CONSTRAINT = 'products_sku_key';

const isSkuUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code, constraint } = error as { code?: string; constraint?: string };
  if (code !== '23505') {
    return false;
  }

  return !constraint || constraint === SKU_UNIQUE_CONSTRAINT;
};

const assertInteger = (value: number, fieldName: string) => {
  if (!Number.isInteger(value)) {
    throw new BadRequestError(`${fieldName} deve ser um inteiro`);
  }
};

class ProductService {
  /**
   * Cria um novo produto (apenas ADMIN)
   * Produtos pertencem a loja, nao a revendedores
   */
  async create(data: CreateProductDTO, user: AuthenticatedUser): Promise<Product> {
    if (!hasPermission(user, 'products:create')) {
      throw new ForbiddenError('Voce nao tem permissao para criar produtos');
    }

    // Verificar duplicidade de SKU se fornecido
    if (data.sku) {
      const skuExists = await productRepository.skuExists(data.sku);
      if (skuExists) {
        throw new ConflictError('SKU ja existe');
      }
    }

    try {
      return await productRepository.create({
        name: data.name,
        description: data.description,
        sku: data.sku,
        price: data.price,
        stock: data.stock ?? 0,
      });
    } catch (error) {
      if (isSkuUniqueViolation(error)) {
        throw new ConflictError('SKU ja existe');
      }
      throw error;
    }
  }

  /**
   * Busca produto por ID
   * Apenas ADMIN pode visualizar via modulo de produtos
   */
  async findById(id: string, user: AuthenticatedUser): Promise<Product> {
    if (!hasPermission(user, 'products:read')) {
      throw new ForbiddenError('Voce nao tem permissao para visualizar produtos');
    }
    return productRepository.findById(id);
  }

  /**
   * Lista produtos com filtros
   * Apenas ADMIN pode listar via modulo de produtos
   */
  async findAll(params: ProductListParams, user: AuthenticatedUser): Promise<PaginatedResponse<Product>> {
    if (!hasPermission(user, 'products:read')) {
      throw new ForbiddenError('Voce nao tem permissao para listar produtos');
    }
    return productRepository.findAll(params);
  }

  /**
   * Atualiza produto (apenas ADMIN)
   */
  async update(id: string, data: UpdateProductDTO, user: AuthenticatedUser): Promise<Product> {
    if (!hasPermission(user, 'products:update')) {
      throw new ForbiddenError('Voce nao tem permissao para atualizar produtos');
    }

    const product = await productRepository.findById(id);

    // Verificar duplicidade de SKU se estiver alterando
    if (data.sku && data.sku !== product.sku) {
      const skuExists = await productRepository.skuExists(data.sku, id);
      if (skuExists) {
        throw new ConflictError('SKU ja existe');
      }
    }

    try {
      return await productRepository.update(id, data);
    } catch (error) {
      if (isSkuUniqueViolation(error)) {
        throw new ConflictError('SKU ja existe');
      }
      throw error;
    }
  }

  /**
   * Atualiza estoque do produto (apenas ADMIN)
   */
  async updateStock(id: string, quantity: number, user: AuthenticatedUser): Promise<Product> {
    if (!hasPermission(user, 'products:update')) {
      throw new ForbiddenError('Voce nao tem permissao para atualizar estoque');
    }

    assertInteger(quantity, 'Quantidade de estoque');
    if (quantity < 0) {
      throw new BadRequestError('Quantidade de estoque deve ser >= 0');
    }

    // Verificar se produto existe
    await productRepository.findById(id);

    return productRepository.updateStock(id, quantity);
  }

  /**
   * Ajusta estoque (incrementa/decrementa) (apenas ADMIN)
   */
  async adjustStock(id: string, delta: number, user: AuthenticatedUser): Promise<Product> {
    if (!hasPermission(user, 'products:update')) {
      throw new ForbiddenError('Voce nao tem permissao para ajustar estoque');
    }

    assertInteger(delta, 'Delta de estoque');

    // Verificar se produto existe
    await productRepository.findById(id);

    return productRepository.adjustStock(id, delta);
  }

  /**
   * Remove produto (soft delete - marca como inativo) (apenas ADMIN)
   */
  async delete(id: string, user: AuthenticatedUser): Promise<void> {
    if (!hasPermission(user, 'products:delete')) {
      throw new ForbiddenError('Voce nao tem permissao para remover produtos');
    }

    // Verificar se produto existe
    await productRepository.findById(id);

    await productRepository.delete(id);
  }

  /**
   * Remove produto permanentemente (hard delete) (apenas ADMIN)
   */
  async hardDelete(id: string, user: AuthenticatedUser): Promise<void> {
    if (!hasPermission(user, 'products:delete')) {
      throw new ForbiddenError('Voce nao tem permissao para remover produtos permanentemente');
    }

    const hasKitItems = await productRepository.hasKitItems(id);
    if (hasKitItems) {
      throw new ConflictError('Produto possui itens em kits e nao pode ser removido permanentemente');
    }

    await productRepository.hardDelete(id);
  }

  /**
   * Conta total de produtos
   */
  async count(activeOnly: boolean = false): Promise<number> {
    return productRepository.count(activeOnly);
  }

  /**
   * Estatisticas de produtos (apenas ADMIN)
   */
  async getStats(user: AuthenticatedUser): Promise<ProductStats> {
    if (!hasPermission(user, 'products:read')) {
      throw new ForbiddenError('Voce nao tem permissao para visualizar estatisticas');
    }

    return productRepository.getStats();
  }
}

export default new ProductService();
