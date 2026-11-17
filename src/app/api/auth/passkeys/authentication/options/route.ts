import type { NextRequest } from "next/server";
import {
  createAuthenticationOptions,
  handlePasskeyError,
} from "@/features/auth/services/passkey-server";

export function POST(request: NextRequest) {
  return handlePasskeyError(
    () => createAuthenticationOptions(request),
    "autenticacao-opcoes",
  );
}
