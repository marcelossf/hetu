import type { NextRequest } from "next/server";
import {
  handlePasskeyError,
  updateBiometricPreference,
} from "@/features/auth/services/passkey-server";

export function POST(request: NextRequest) {
  return handlePasskeyError(
    () => updateBiometricPreference(request),
    "preferencias-biometricas",
  );
}
