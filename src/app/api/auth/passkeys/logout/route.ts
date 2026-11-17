import type { NextRequest } from "next/server";
import {
  handlePasskeyError,
  signOutPasskeySession,
} from "@/features/auth/services/passkey-server";

export function POST(request: NextRequest) {
  return handlePasskeyError(() => signOutPasskeySession(request));
}
