import "fastify";
import type { AuthenticatedUser } from "./auth";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
