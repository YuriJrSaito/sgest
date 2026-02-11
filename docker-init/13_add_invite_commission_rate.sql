-- Adiciona campo de comissao no convite para uso na criacao do reseller_profile
ALTER TABLE invites
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2);

COMMENT ON COLUMN invites.commission_rate IS 'Percentual de comissao sugerido para o revendedor (ex: 10.00)';
