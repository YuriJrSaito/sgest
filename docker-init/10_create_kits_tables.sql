-- Tabelas do modulo de Kits (consignacao de produtos para revendedores)

CREATE TABLE IF NOT EXISTS kits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    reseller_id UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kits_status ON kits(status);
CREATE INDEX IF NOT EXISTS idx_kits_reseller_id ON kits(reseller_id);
CREATE INDEX IF NOT EXISTS idx_kits_created_by ON kits(created_by);
CREATE INDEX IF NOT EXISTS idx_kits_code ON kits(code);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_kits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kits_updated_at ON kits;
CREATE TRIGGER trigger_kits_updated_at
    BEFORE UPDATE ON kits
    FOR EACH ROW
    EXECUTE FUNCTION update_kits_updated_at();

-- Itens do kit (produtos vinculados)
CREATE TABLE IF NOT EXISTS kit_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(kit_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_kit_items_kit_id ON kit_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_items_product_id ON kit_items(product_id);
