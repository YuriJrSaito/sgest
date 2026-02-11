-- Tabela de convites para o sistema invite-only
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    role_to_assign VARCHAR(50) NOT NULL,  -- ADMIN, RESELLER
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,  -- NULL enquanto nao usado
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indices para buscas rapidas
CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_expires_at ON invites(expires_at);
CREATE INDEX idx_invites_used_at ON invites(used_at);

-- Comentarios
COMMENT ON TABLE invites IS 'Sistema de convites para cadastro de novos usuarios';
COMMENT ON COLUMN invites.token IS 'Token unico gerado para o convite (UUID)';
COMMENT ON COLUMN invites.role_to_assign IS 'Role que o usuario tera ao aceitar: ADMIN ou RESELLER';
COMMENT ON COLUMN invites.expires_at IS 'Data de expiracao do convite';
COMMENT ON COLUMN invites.used_at IS 'Data em que o convite foi aceito (NULL = pendente)';
COMMENT ON COLUMN invites.created_by IS 'Admin que criou o convite';
