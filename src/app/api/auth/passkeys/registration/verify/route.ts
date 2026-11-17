import type { NextRequest } from "next/server";
import {
  handlePasskeyError,
  verifyRegistration,
} from "@/features/auth/services/passkey-server";

export function POST(request: NextRequest) {
  return handlePasskeyError(() => verifyRegistration(request));
}
