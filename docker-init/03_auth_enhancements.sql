-- Auth Enhancements: Refresh Tokens, Token Blacklist, Password Reset, Login Attempts, Audit Logs
-- Este script adiciona tabelas para recursos avançados de autenticação e segurança

-- ============================================
-- REFRESH TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    jti VARCHAR(255) NOT NULL UNIQUE,
    family_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    replaced_by_jti VARCHAR(255),
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TOKEN BLACKLIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jti VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    reason VARCHAR(100),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PASSWORD RESET TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LOGIN ATTEMPTS TABLE (Brute Force Protection)
-- ============================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    success BOOLEAN NOT NULL,
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES (Críticos para performance)
-- ============================================

-- Refresh Tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_jti ON refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Token Blacklist
CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- Password Reset Tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at ON password_reset_tokens(expires_at);

-- Login Attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_composite ON login_attempts(email, ip_address, created_at);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite ON audit_logs(user_id, action, created_at);

-- ============================================
-- CLEANUP FUNCTION (Auto-delete expired records)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- Clean expired blacklisted tokens (keep 7 days after expiration)
    DELETE FROM token_blacklist
    WHERE expires_at < NOW() - INTERVAL '7 days';

    -- Clean expired refresh tokens (keep 7 days after expiration)
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days';

    -- Clean used or expired password reset tokens
    DELETE FROM password_reset_tokens
    WHERE (used = true AND used_at < NOW() - INTERVAL '24 hours')
       OR (expires_at < NOW() - INTERVAL '24 hours');

    -- Clean old login attempts (keep last 30 days for security analysis)
    DELETE FROM login_attempts
    WHERE created_at < NOW() - INTERVAL '30 days';

    -- Clean old audit logs (keep last 90 days for compliance)
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMENTÁRIOS DAS TABELAS
-- ============================================
COMMENT ON TABLE refresh_tokens IS 'Armazena refresh tokens para autenticação de longa duração';
COMMENT ON TABLE token_blacklist IS 'Lista de tokens access revogados (logout, password change, etc)';
COMMENT ON TABLE password_reset_tokens IS 'Tokens de recuperação de senha de uso único';
COMMENT ON TABLE login_attempts IS 'Rastreamento de tentativas de login para proteção contra brute force';
COMMENT ON TABLE audit_logs IS 'Log de auditoria de eventos de autenticação e segurança';
