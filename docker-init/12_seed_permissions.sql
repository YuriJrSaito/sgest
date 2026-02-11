-- Permissoes base
INSERT INTO permissions (code, name, description, resource, action) VALUES
-- Products
('products:create', 'Criar produtos', 'Permite criar novos produtos', 'products', 'create'),
('products:read', 'Visualizar produtos', 'Permite visualizar produtos', 'products', 'read'),
('products:update', 'Editar produtos', 'Permite editar produtos', 'products', 'update'),
('products:delete', 'Excluir produtos', 'Permite excluir produtos', 'products', 'delete'),
-- Kits
('kits:create', 'Criar kits', 'Permite criar novos kits', 'kits', 'create'),
('kits:read', 'Visualizar kits', 'Permite visualizar kits', 'kits', 'read'),
('kits:read:own', 'Visualizar proprios kits', 'Permite visualizar apenas kits atribuidos ao usuario', 'kits', 'read:own'),
('kits:update', 'Editar kits', 'Permite editar kits', 'kits', 'update'),
('kits:delete', 'Excluir kits', 'Permite excluir kits', 'kits', 'delete'),
('kits:assign', 'Atribuir kits', 'Permite atribuir kits para revendedoras', 'kits', 'assign'),
-- Users
('users:read', 'Visualizar usuarios', 'Permite visualizar usuarios', 'users', 'read'),
('users:manage', 'Gerenciar usuarios', 'Permite gerenciar usuarios', 'users', 'manage'),
-- Invites
('invites:create', 'Criar convites', 'Permite criar convites', 'invites', 'create'),
('invites:read', 'Visualizar convites', 'Permite visualizar convites', 'invites', 'read'),
('invites:delete', 'Excluir convites', 'Permite excluir convites', 'invites', 'delete'),
-- Notifications
('notifications:broadcast', 'Broadcast de notificacoes', 'Permite enviar notificacoes em massa', 'notifications', 'broadcast'),
-- Reports
('reports:view', 'Visualizar relatorios', 'Permite visualizar relatorios e metricas', 'reports', 'view'),
-- Profile
('profile:read', 'Visualizar perfil', 'Permite visualizar o proprio perfil', 'profile', 'read'),
('profile:update', 'Editar perfil', 'Permite editar o proprio perfil', 'profile', 'update')
ON CONFLICT (code) DO NOTHING;

-- Papeis base
INSERT INTO roles (code, name, description, is_system) VALUES
('ADMIN', 'Administrador', 'Acesso total do sistema', TRUE),
('GERENTE', 'Gerente', 'Gerencia produtos e usuarios', FALSE),
('RESELLER', 'Revendedora', 'Acesso limitado aos proprios recursos', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ADMIN recebe tudo
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- GERENTE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'products:read',
    'kits:read',
    'kits:assign',
    'users:read',
    'reports:view',
    'profile:read',
    'profile:update'
)
WHERE r.code = 'GERENTE'
ON CONFLICT DO NOTHING;

-- RESELLER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'kits:read:own',
    'profile:read',
    'profile:update'
)
WHERE r.code = 'RESELLER'
ON CONFLICT DO NOTHING;
