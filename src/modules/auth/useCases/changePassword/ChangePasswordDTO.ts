// src/modules/auth/useCases/changePassword/ChangePasswordDTO.ts

import { RequestContext } from "../../../../types";

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  accessToken?: string;
}

export type ChangePasswordContext = RequestContext;
