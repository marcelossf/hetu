import type { NextRequest } from "next/server";
import {
  createRegistrationOptions,
  handlePasskeyError,
} from "@/features/auth/services/passkey-server";

export function POST(request: NextRequest) {
  return handlePasskeyError(
    () => createRegistrationOptions(request),
    "registro-opcoes",
  );
}
