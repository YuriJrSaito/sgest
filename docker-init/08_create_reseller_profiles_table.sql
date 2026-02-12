-- Tabela de perfis de revendedor (dados especificos de venda B2B)
CREATE TABLE IF NOT EXISTS reseller_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,  -- Percentual de comissao (ex: 10.00%)
    pix_key VARCHAR(255),  -- Chave PIX para recebimento
    max_discount_allowed DECIMAL(5,2) NOT NULL DEFAULT 0,  -- Desconto maximo permitido (%)
    credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0,  -- Limite de credito
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indice para busca por usuario
CREATE INDEX IF NOT EXISTS idx_reseller_profiles_user_id ON reseller_profiles(user_id);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_reseller_profiles_updated_at ON reseller_profiles;
CREATE TRIGGER update_reseller_profiles_updated_at
    BEFORE UPDATE ON reseller_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE reseller_profiles IS 'Perfis de revendedor com dados especificos de venda';
COMMENT ON COLUMN reseller_profiles.commission_rate IS 'Percentual de comissao sobre vendas (ex: 10.00 = 10%)';
COMMENT ON COLUMN reseller_profiles.pix_key IS 'Chave PIX para recebimento de comissoes';
COMMENT ON COLUMN reseller_profiles.max_discount_allowed IS 'Percentual maximo de desconto que o revendedor pode dar';
COMMENT ON COLUMN reseller_profiles.credit_limit IS 'Limite de credito disponivel para o revendedor';
