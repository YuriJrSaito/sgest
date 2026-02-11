// src/modules/auth/useCases/login/LoginDTO.ts
// DTOs do caso de uso de login

import { PermissionCode, RequestContext, UserRole, UserStatus } from "../../../../types";

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginContext = RequestContext;

export interface LoginOutput {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    permissions: PermissionCode[];
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}
