import type { NextRequest } from "next/server";
import {
  getPasskeyStatus,
  handlePasskeyError,
} from "@/features/auth/services/passkey-server";

export function GET(request: NextRequest) {
  return handlePasskeyError(() => getPasskeyStatus(request), "status");
}
