// src/modules/auth/useCases/refreshToken/RefreshTokenDTO.ts

import { PermissionCode, RequestContext, UserRole, UserStatus } from "../../../../types";

export interface RefreshTokenInput {
  refreshToken: string;
}

export type RefreshTokenContext = RequestContext;

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    permissions: PermissionCode[];
  };
}
