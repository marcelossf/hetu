import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import {
  handlePasskeyError,
  isAuthenticatedUser,
  requireUnlockedUser,
} from "@/features/auth/services/passkey-server";

type ProtectedSupabaseOperation = (
  request: NextRequest,
  supabase: SupabaseClient<Database>,
) => Promise<Response>;

export function createProtectedSupabaseHandler(
  operationName: string,
  operation: ProtectedSupabaseOperation,
) {
  return function protectedSupabaseHandler(request: NextRequest) {
    return handlePasskeyError(async () => {
      const user = await requireUnlockedUser(request);
      if (!isAuthenticatedUser(user)) return user;

      const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) {
        return Response.json(
          { error: "Entre com sua conta Google para continuar." },
          { status: 401 },
        );
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) {
        throw new Error("As configurações públicas do Supabase não estão completas.");
      }

      const supabase = createClient<Database>(url, anonKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      });

      return operation(request, supabase);
    }, operationName);
  };
}

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonRecord(
  request: NextRequest,
): Promise<Record<string, unknown> | Response> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return Response.json({ error: "O corpo da solicitação não é um JSON válido." }, {
      status: 400,
    });
  }

  if (!isJsonRecord(value)) {
    return Response.json({ error: "O corpo da solicitação deve ser um objeto JSON." }, {
      status: 400,
    });
  }

  return value;
}

export function isErrorResponse(
  value: Record<string, unknown> | Response,
): value is Response {
  return value instanceof Response;
}
