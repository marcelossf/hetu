import type { NextRequest } from "next/server";
import {
  handlePasskeyError,
  verifyAuthentication,
} from "@/features/auth/services/passkey-server";

export function POST(request: NextRequest) {
  return handlePasskeyError(() => verifyAuthentication(request));
}
