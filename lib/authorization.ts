import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";

export type ApplicationRole = "user" | "admin";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: ApplicationRole;
};

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class UnauthorizedError extends AuthorizationError {
  constructor() {
    super("Unauthorized", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AuthorizationError {
  constructor() {
    super("Forbidden", 403);
    this.name = "ForbiddenError";
  }
}

function isApplicationRole(role: string): role is ApplicationRole {
  return role === "user" || role === "admin";
}

function toAuthenticatedUser(session: Session): AuthenticatedUser {
  const { id, name, email, role } = session.user;

  if (!id || !name || !email || !isApplicationRole(role)) {
    throw new UnauthorizedError();
  }

  return { id, name, email, role };
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new UnauthorizedError();
  }

  return toAuthenticatedUser(session);
}

export async function requireRole(
  ...allowedRoles: readonly ApplicationRole[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError();
  }

  return user;
}

export function assertOwnership(
  ownerId: string | null | undefined,
  user: AuthenticatedUser
): void {
  if (!ownerId || (ownerId !== user.id && ownerId !== user.email)) {
    throw new ForbiddenError();
  }
}