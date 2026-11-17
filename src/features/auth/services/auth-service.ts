"use client";

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

type RegistrationOptions = PublicKeyCredentialCreationOptionsJSON;
type AuthenticationOptions = PublicKeyCredentialRequestOptionsJSON;

type PasskeyStatus = {
  hasPasskey: boolean;
  canRegisterPasskey: boolean;
  biometricEnabled: boolean;
};

let unlockedPageNonce: string | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(body: unknown): string | null {
  return isRecord(body) && typeof body.error === "string" ? body.error : null;
}

async function requestJson(
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(typeof body?.pageNonce === "string"
        ? { "X-Hetu-Page-Nonce": body.pageNonce }
        : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "same-origin",
    cache: "no-store",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!response.ok) {
    throw new Error(
      getErrorMessage(responseBody) ??
        "Não foi possível concluir a verificação do dispositivo.",
    );
  }
  return responseBody;
}

function isRegistrationOptions(value: unknown): value is RegistrationOptions {
  if (
    !isRecord(value) ||
    typeof value.challenge !== "string" ||
    !isRecord(value.rp) ||
    typeof value.rp.id !== "string" ||
    typeof value.rp.name !== "string" ||
    !isRecord(value.user) ||
    typeof value.user.id !== "string" ||
    typeof value.user.name !== "string" ||
    typeof value.user.displayName !== "string" ||
    !Array.isArray(value.pubKeyCredParams) ||
    !value.pubKeyCredParams.every(
      (parameter) =>
        isRecord(parameter) &&
        typeof parameter.type === "string" &&
        typeof parameter.alg === "number",
    )
  ) {
    return false;
  }
  return true;
}

function isAuthenticationOptions(value: unknown): value is AuthenticationOptions {
  if (
    !isRecord(value) ||
    typeof value.challenge !== "string" ||
    typeof value.rpId !== "string" ||
    !Array.isArray(value.allowCredentials) ||
    !value.allowCredentials.every(
      (credential) => isRecord(credential) && typeof credential.id === "string",
    )
  ) {
    return false;
  }
  return true;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToSession(
  onChange: (session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    onChange(session);
  });
  return () => subscription.unsubscribe();
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOutFromHetu(): Promise<void> {
  let cleanupError: string | null = null;
  try {
    const cleanupResponse = await fetch("/api/auth/passkeys/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!cleanupResponse.ok) {
      cleanupError = `HTTP ${cleanupResponse.status}`;
    }
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : "falha de rede";
  }

  const { error } = await getSupabaseClient().auth.signOut();
  unlockedPageNonce = null;
  if (error) throw error;
  if (cleanupError) {
    console.warn(
      "A sessão Supabase foi encerrada, mas não foi possível limpar os cookies de passkey:",
      cleanupError,
    );
  }
}

export function markPageUnlocked(pageNonce: string): void {
  unlockedPageNonce = pageNonce;
}

export function lockCurrentPage(): void {
  unlockedPageNonce = null;
}

export function getUnlockedApiHeaders(accessToken: string): HeadersInit {
  if (!unlockedPageNonce) {
    throw new Error("Desbloqueie o aplicativo antes de acessar os dados.");
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Hetu-Page-Nonce": unlockedPageNonce,
  };
}

export async function getPasskeyStatus(
  accessToken: string,
): Promise<PasskeyStatus> {
  const result = await requestJson("/api/auth/passkeys/status", accessToken);
  if (
    !isRecord(result) ||
    typeof result.hasPasskey !== "boolean" ||
    typeof result.canRegisterPasskey !== "boolean" ||
    typeof result.biometricEnabled !== "boolean"
  ) {
    throw new Error("Não foi possível confirmar o estado da passkey.");
  }
  return {
    hasPasskey: result.hasPasskey,
    canRegisterPasskey: result.canRegisterPasskey,
    biometricEnabled: result.biometricEnabled,
  };
}

export async function setBiometricPreference(
  accessToken: string,
  pageNonce: string,
  biometricEnabled: boolean,
): Promise<void> {
  await requestJson("/api/auth/passkeys/settings", accessToken, {
    pageNonce,
    biometricEnabled,
  });
}

export function supportsPasskeys(): boolean {
  return browserSupportsWebAuthn();
}

export async function registerPasskey(
  accessToken: string,
  pageNonce: string,
): Promise<void> {
  const optionsResponse = await requestJson(
    "/api/auth/passkeys/registration/options",
    accessToken,
    { pageNonce },
  );
  if (!isRecord(optionsResponse) || !("options" in optionsResponse)) {
    throw new Error("O servidor não retornou opções de cadastro.");
  }
  if (!isRegistrationOptions(optionsResponse.options)) {
    throw new Error("As opções de cadastro de passkey estão inválidas.");
  }

  const credential = await startRegistration({
    optionsJSON: optionsResponse.options,
  });
  await requestJson("/api/auth/passkeys/registration/verify", accessToken, {
    credential,
    pageNonce,
  });
}

export async function authenticateWithPasskey(
  accessToken: string,
  pageNonce: string,
): Promise<void> {
  const optionsResponse = await requestJson(
    "/api/auth/passkeys/authentication/options",
    accessToken,
    { pageNonce },
  );
  if (!isRecord(optionsResponse) || !("options" in optionsResponse)) {
    throw new Error("O servidor não retornou opções de autenticação.");
  }
  if (!isAuthenticationOptions(optionsResponse.options)) {
    throw new Error("As opções de autenticação por passkey estão inválidas.");
  }

  const credential = await startAuthentication({
    optionsJSON: optionsResponse.options,
  });
  await requestJson("/api/auth/passkeys/authentication/verify", accessToken, {
    credential,
    pageNonce,
  });
}
