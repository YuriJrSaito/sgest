// src/modules/auth/useCases/profile/ProfileDTO.ts

import { PermissionCode, UserRole, UserStatus } from "../../../../types";

export interface GetProfileInput {
  userId: string;
}

export interface UpdateProfileInput {
  userId: string;
  name?: string;
  email?: string;
}

export interface ProfileOutput {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  permissions: PermissionCode[];
  created_at: Date;
  updated_at: Date;
}
