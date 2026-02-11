-- =============================================================================
-- Tabela: products
-- Produtos da loja (gerenciados apenas pelo Admin)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Dados do produto
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100) UNIQUE,  -- SKU unico global
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- Comentarios
COMMENT ON TABLE products IS 'Produtos da loja gerenciados pelo Admin';
COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit - codigo unico do produto';
COMMENT ON COLUMN products.price IS 'Preco em reais (BRL)';
