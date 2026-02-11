// src/modules/auth/useCases/logout/LogoutDTO.ts

import { RequestContext } from "../../../../types";

export interface LogoutInput {
  userId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface LogoutAllInput {
  userId: string;
  accessToken: string;
}

export type LogoutContext = RequestContext;
