import type { PaginationParams } from './pagination';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  stock: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// DTO para criacao de produto (entrada da API - camelCase)
export interface CreateProductDTO {
  name: string;
  description?: string;
  sku?: string;
  price: number;
  stock?: number;
}

// Dados internos para o repository
export interface CreateProductData {
  name: string;
  description?: string;
  sku?: string;
  price: number;
  stock: number;
}

// DTO para atualizacao de produto (todos opcionais)
export interface UpdateProductDTO {
  name?: string;
  description?: string;
  sku?: string;
  price?: number;
  stock?: number;
  active?: boolean;
}

// Parametros de listagem de produtos
export interface ProductListParams extends PaginationParams {
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  inStock?: boolean;
  active?: boolean;
}

export interface ProductStats {
  total: number;
  active: number;
  inactive: number;
  outOfStock: number;
  lowStock: number;
}
