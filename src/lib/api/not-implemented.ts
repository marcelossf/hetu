import type { NextRequest } from "next/server";
import {
  handlePasskeyError,
  isAuthenticatedUser,
  requireUnlockedUser,
} from "@/features/auth/services/passkey-server";

export function createNotImplementedHandler(domain: string) {
  return function notImplementedHandler() {
    return Response.json(
      { error: `O endpoint ${domain} ainda não foi implementado.` },
      { status: 501 },
    );
  };
}

export function createProtectedNotImplementedHandler(domain: string) {
  return function protectedNotImplementedHandler(request: NextRequest) {
    return handlePasskeyError(async () => {
      const session = await requireUnlockedUser(request);
      if (!isAuthenticatedUser(session)) return session;

      return Response.json(
        { error: `O endpoint ${domain} ainda não foi implementado.` },
        { status: 501 },
      );
    });
  };
}
