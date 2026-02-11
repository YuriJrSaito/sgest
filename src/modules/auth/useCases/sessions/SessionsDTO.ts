// src/modules/auth/useCases/sessions/SessionsDTO.ts

import { RequestContext } from "../../../../types";

export interface GetSessionsInput {
  userId: string;
  currentRefreshToken?: string;
}

export interface RevokeSessionInput {
  userId: string;
  sessionId: string;
}

export type RevokeSessionContext = RequestContext;

export interface SessionOutput {
  id: string;
  user_agent?: string;
  ip_address?: string;
  last_activity: Date;
  created_at: Date;
  is_current: boolean;
}
