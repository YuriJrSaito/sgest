// src/__tests__/helpers/testHelpers.ts
import database from '../../config/database';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { UserRole } from '../../types';

export async function cleanDatabase(): Promise<void> {
  // Limpar na ordem correta (dependencias primeiro)
  await database.query('TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE token_blacklist RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE refresh_tokens RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE invites RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE notifications RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE kit_items RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE kits RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE reseller_profiles RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE products RESTART IDENTITY CASCADE');
  await database.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
}

export async function createTestUser(data?: {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  status?: 'ACTIVE' | 'INACTIVE';
}) {
  const passwordHash = await bcrypt.hash(data?.password || 'senha123', 10);

  const query = `
    INSERT INTO users (name, email, password_hash, role, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, email, role, status, created_at
  `;

  const result = await database.query(query, [
    data?.name || 'Test User',
    data?.email || 'test@email.com',
    passwordHash,
    data?.role || 'RESELLER',
    data?.status || 'ACTIVE',
  ]);

  return result.rows[0];
}

export function generateToken(userId: string, email: string, role: UserRole = 'RESELLER'): string {
  return jwt.sign(
    { id: userId, email, role, jti: `test-jti-${Date.now()}` },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
  );
}

export async function createAdminUser(data?: {
  name?: string;
  email?: string;
  password?: string;
}) {
  const passwordHash = await bcrypt.hash(data?.password || 'Admin@123', 10);

  const query = `
    INSERT INTO users (name, email, password_hash, role, status)
    VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')
    RETURNING id, name, email, role, status, created_at
  `;

  const result = await database.query(query, [
    data?.name || 'Admin User',
    data?.email || 'admin@email.com',
    passwordHash,
  ]);

  return result.rows[0];
}

export async function createResellerWithProfile(data?: {
  name?: string;
  email?: string;
  password?: string;
  commissionRate?: number;
  pixKey?: string;
}) {
  const passwordHash = await bcrypt.hash(data?.password || 'Senha@123', 10);

  // Create user first
  const userQuery = `
    INSERT INTO users (name, email, password_hash, role, status)
    VALUES ($1, $2, $3, 'RESELLER', 'ACTIVE')
    RETURNING id, name, email, role, status, created_at
  `;

  const userResult = await database.query(userQuery, [
    data?.name || 'Test Reseller',
    data?.email || 'reseller@email.com',
    passwordHash,
  ]);
  const user = userResult.rows[0];

  // Create reseller profile
  const profileQuery = `
    INSERT INTO reseller_profiles (user_id, commission_rate, pix_key)
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const profileResult = await database.query(profileQuery, [
    user.id,
    data?.commissionRate ?? 10.00,
    data?.pixKey || null,
  ]);

  return {
    user,
    profile: profileResult.rows[0],
  };
}

export async function createInvite(data: {
  email: string;
  createdBy: string;
  roleToAssign?: UserRole;
  expiresAt?: Date;
  commissionRate?: number | null;
}) {
  const token = `test-invite-token-${Date.now()}`;
  const expiresAt = data.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  const query = `
    INSERT INTO invites (email, token, role_to_assign, commission_rate, expires_at, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await database.query(query, [
    data.email,
    token,
    data.roleToAssign || 'RESELLER',
    data.commissionRate ?? null,
    expiresAt,
    data.createdBy,
  ]);

  return result.rows[0];
}
