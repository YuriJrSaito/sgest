-- =============================================================================
-- Seed: Admin inicial
-- Este script cria um usuario admin padrao para desenvolvimento
-- =============================================================================

-- Senha: Admin@123 (hash bcrypt com salt 10)
-- IMPORTANTE: Altere a senha apos o primeiro login em producao!

INSERT INTO users (name, email, password_hash, role, status)
VALUES (
  'Administrador',
  'admin@sgest.com',
  '$2b$10$2qqLsNWC2YtnpozqLU/Elu1tCppetuHKh0AqNuak3uJt8ZT21yGxq', -- Admin@123
  'ADMIN',
  'ACTIVE'
)
ON CONFLICT (email) DO NOTHING;

-- Exibe confirmacao
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email = 'admin@sgest.com') THEN
    RAISE NOTICE 'Admin criado: admin@sgest.com / Admin@123';
  END IF;
END $$;
