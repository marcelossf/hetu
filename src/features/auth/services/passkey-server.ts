import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { createClient } from "@supabase/supabase-js";
import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

const challengeCookieName = "hetu_webauthn_challenge";
const unlockedCookieName = "hetu_unlocked";
const challengeLifetimeSeconds = 5 * 60;
const unlockedLifetimeSeconds = 8 * 60 * 60;
const recentGoogleLoginSeconds = 10 * 60;
const relyingPartyName = "Hetu";

type ChallengePurpose = "registration" | "authentication";

type SignedChallenge = {
  challenge: string;
  userId: string;
  pageNonce: string;
  purpose: ChallengePurpose;
  issuedAt: number;
};

// The nonce exists only in page memory, so a saved unlock cookie cannot unlock a later app opening.
type UnlockedSession = {
  userId: string;
  pageNonce: string;
  expiresAt: number;
};

type AuthContext = {
  userId: string;
  email: string;
  authTime: number | null;
  provider: string;
  database: ReturnType<typeof createPasskeyDatabaseClient>;
};

type RelyingParty = {
  origin: string;
  id: string;
  secure: boolean;
};

type RegistrationResponse = Parameters<typeof verifyRegistrationResponse>[0]["response"];
type AuthenticationResponse = Parameters<typeof verifyAuthenticationResponse>[0]["response"];

export type PasskeyCredential = Database["public"]["Tables"]["user_passkeys"]["Row"];

export class PasskeyRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PasskeyRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRegistrationResponse(value: unknown): value is RegistrationResponse {
  return (
    isRecord(value) &&
    value.type === "public-key" &&
    typeof value.id === "string" &&
    typeof value.rawId === "string" &&
    isRecord(value.clientExtensionResults) &&
    isRecord(value.response) &&
    typeof value.response.clientDataJSON === "string" &&
    typeof value.response.attestationObject === "string"
  );
}

function isAuthenticationResponse(value: unknown): value is AuthenticationResponse {
  return (
    isRecord(value) &&
    value.type === "public-key" &&
    typeof value.id === "string" &&
    typeof value.rawId === "string" &&
    isRecord(value.clientExtensionResults) &&
    isRecord(value.response) &&
    typeof value.response.clientDataJSON === "string" &&
    typeof value.response.authenticatorData === "string" &&
    typeof value.response.signature === "string" &&
    (value.response.userHandle === undefined ||
      typeof value.response.userHandle === "string")
  );
}

function createUserScopedSupabaseClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("As configurações públicas do Supabase não estão completas.");
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

function createPasskeyDatabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("A configuração de servidor do Supabase não está completa.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new PasskeyRequestError("Entre com sua conta Google para continuar.", 401);
  }

  const supabase = createUserScopedSupabaseClient(token);
  const { data, error } = await supabase.auth.getClaims(token);

  if (
    error ||
    !data ||
    !data.claims ||
    typeof data.claims.sub !== "string" ||
    data.claims.role !== "authenticated" ||
    data.claims.is_anonymous === true
  ) {
    throw new PasskeyRequestError("Sua sessão expirou. Entre novamente com Google.", 401);
  }

  const claims = data.claims;
  const appMetadata = claims.app_metadata;
  const providers =
    isRecord(appMetadata) && Array.isArray(appMetadata.providers)
      ? appMetadata.providers.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
  const metadataProvider =
    isRecord(appMetadata) && typeof appMetadata.provider === "string"
      ? appMetadata.provider
      : "";
  const provider = providers.includes("google") ? "google" : metadataProvider;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : claims.sub,
    authTime: typeof claims.auth_time === "number" ? claims.auth_time : null,
    provider,
    database: createPasskeyDatabaseClient(),
  };
}

function getRelyingParty(request: NextRequest): RelyingParty {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const configuredUrl = new URL(configuredOrigin || request.url);
  if (
    configuredUrl.username ||
    configuredUrl.password ||
    configuredUrl.pathname !== "/" ||
    configuredUrl.search ||
    configuredUrl.hash
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL deve conter somente a origem do aplicativo.");
  }
  const origin = configuredUrl.origin;
  const originHeader = request.headers.get("origin");

  if (originHeader && getOrigin(originHeader) !== origin) {
    throw new PasskeyRequestError("A origem da solicitação não é permitida.", 403);
  }

  const url = configuredUrl;
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("WebAuthn exige HTTPS fora do ambiente local.");
  }

  return { origin, id: url.hostname, secure: url.protocol === "https:" };
}

function getOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getSessionSecret(): string {
  const secret = process.env.WEBAUTHN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("WEBAUTHN_SESSION_SECRET precisa ter ao menos 32 caracteres.");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function seal(value: object): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function unseal(value: string | undefined): unknown {
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function serializeCookie(
  name: string,
  value: string,
  secure: boolean,
  maxAge: number,
): string {
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function challengeCookie(
  challenge: string,
  userId: string,
  pageNonce: string,
  purpose: ChallengePurpose,
  secure: boolean,
): string {
  const payload: SignedChallenge = {
    challenge,
    userId,
    pageNonce,
    purpose,
    issuedAt: Date.now(),
  };
  return serializeCookie(
    challengeCookieName,
    seal(payload),
    secure,
    challengeLifetimeSeconds,
  );
}

function unlockedCookie(userId: string, pageNonce: string, secure: boolean): string {
  const session: UnlockedSession = {
    userId,
    pageNonce,
    expiresAt: Date.now() + unlockedLifetimeSeconds * 1000,
  };
  return serializeCookie(
    unlockedCookieName,
    seal(session),
    secure,
    unlockedLifetimeSeconds,
  );
}

function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, "", secure, 0);
}

function isChallengePurpose(value: unknown): value is ChallengePurpose {
  return value === "registration" || value === "authentication";
}

function readChallenge(
  request: NextRequest,
  userId: string,
  pageNonce: string,
  purpose: ChallengePurpose,
): SignedChallenge {
  const cookie = request.cookies.get(challengeCookieName)?.value;
  const value = unseal(cookie);

  if (
    !isRecord(value) ||
    typeof value.challenge !== "string" ||
    value.userId !== userId ||
    value.pageNonce !== pageNonce ||
    !isChallengePurpose(value.purpose) ||
    value.purpose !== purpose ||
    typeof value.issuedAt !== "number" ||
    Date.now() - value.issuedAt > challengeLifetimeSeconds * 1000
  ) {
    throw new PasskeyRequestError(
      "A verificação expirou. Tente novamente.",
      400,
    );
  }

  return {
    challenge: value.challenge,
    userId: value.userId,
    pageNonce: value.pageNonce,
    purpose: value.purpose,
    issuedAt: value.issuedAt,
  };
}

async function saveChallenge(
  context: AuthContext,
  challenge: string,
  pageNonce: string,
  purpose: ChallengePurpose,
): Promise<void> {
  const now = new Date();
  const { error: expiredError } = await context.database
    .from("user_passkey_challenges")
    .delete()
    .eq("user_id", context.userId)
    .lt("expires_at", now.toISOString());

  if (expiredError) {
    throw new Error(`Não foi possível limpar desafios antigos: ${expiredError.message}`);
  }

  const { error: consumedError } = await context.database
    .from("user_passkey_challenges")
    .delete()
    .eq("user_id", context.userId)
    .not("consumed_at", "is", null);

  if (consumedError) {
    throw new Error(`Não foi possível limpar desafios usados: ${consumedError.message}`);
  }

  const { error } = await context.database.from("user_passkey_challenges").insert({
    challenge,
    user_id: context.userId,
    purpose,
    page_nonce: pageNonce,
    expires_at: new Date(now.getTime() + challengeLifetimeSeconds * 1000).toISOString(),
  });

  if (error) {
    throw new Error(`Não foi possível criar o desafio WebAuthn: ${error.message}`);
  }
}

async function consumeChallenge(
  context: AuthContext,
  challenge: SignedChallenge,
): Promise<void> {
  const { data, error } = await context.database
    .from("user_passkey_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("challenge", challenge.challenge)
    .eq("user_id", context.userId)
    .eq("purpose", challenge.purpose)
    .eq("page_nonce", challenge.pageNonce)
    .gt("expires_at", new Date().toISOString())
    .is("consumed_at", null)
    .select("challenge")
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível confirmar o desafio WebAuthn: ${error.message}`);
  }
  if (!data) {
    throw new PasskeyRequestError("Este desafio já expirou ou foi utilizado.", 400);
  }
}

function isValidPageNonce(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function requirePageNonce(value: unknown): string {
  if (!isValidPageNonce(value)) {
    throw new PasskeyRequestError("A sessão desta tela expirou. Recarregue e tente novamente.", 400);
  }
  return value;
}

function hasRecentGoogleLogin(context: AuthContext): boolean {
  const loginAge =
    context.authTime === null ? Number.POSITIVE_INFINITY : Date.now() / 1000 - context.authTime;
  return (
    context.provider === "google" &&
    loginAge >= 0 &&
    loginAge <= recentGoogleLoginSeconds
  );
}

function requireRecentGoogleLogin(context: AuthContext): void {
  if (!hasRecentGoogleLogin(context)) {
    throw new PasskeyRequestError(
      "Para cadastrar uma passkey, entre novamente com sua conta Google.",
      403,
    );
  }
}

async function getCredentials(
  context: AuthContext,
): Promise<PasskeyCredential[]> {
  const { data, error } = await context.database
    .from("user_passkeys")
    .select("*")
    .eq("user_id", context.userId);

  if (error) {
    throw new Error(`Não foi possível consultar as passkeys: ${error.message}`);
  }
  return data;
}

async function readJsonBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new PasskeyRequestError("O corpo da solicitação não contém JSON válido.", 400);
  }

  if (!isRecord(value)) {
    throw new PasskeyRequestError("O formato da solicitação é inválido.", 400);
  }
  return value;
}

function assertSameOrigin(request: NextRequest, relyingParty: RelyingParty): void {
  const origin = request.headers.get("origin");
  if (!origin || getOrigin(origin) !== relyingParty.origin) {
    throw new PasskeyRequestError("A origem da solicitação não é permitida.", 403);
  }
}

export async function getPasskeyStatus(request: NextRequest): Promise<Response> {
  const context = await getAuthContext(request);
  const credentials = await getCredentials(context);
  const canRegisterPasskey = hasRecentGoogleLogin(context);

  return Response.json({
    hasPasskey: credentials.length > 0,
    canRegisterPasskey,
  });
}

export async function createRegistrationOptions(
  request: NextRequest,
): Promise<Response> {
  const context = await getAuthContext(request);
  const relyingParty = getRelyingParty(request);
  assertSameOrigin(request, relyingParty);
  const body = await readJsonBody(request);
  const pageNonce = requirePageNonce(body.pageNonce);
  requireRecentGoogleLogin(context);

  const credentials = await getCredentials(context);
  const options = await generateRegistrationOptions({
    rpName: relyingPartyName,
    rpID: relyingParty.id,
    userID: new Uint8Array(Buffer.from(context.userId)),
    userName: context.email,
    attestationType: "none",
    excludeCredentials: credentials.map((credential) => ({
      id: credential.credential_id,
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  await saveChallenge(context, options.challenge, pageNonce, "registration");
  const response = Response.json({ options, pageNonce });
  response.headers.append(
    "Set-Cookie",
    challengeCookie(
      options.challenge,
      context.userId,
      pageNonce,
      "registration",
      relyingParty.secure,
    ),
  );
  return response;
}

export async function verifyRegistration(
  request: NextRequest,
): Promise<Response> {
  const context = await getAuthContext(request);
  const relyingParty = getRelyingParty(request);
  assertSameOrigin(request, relyingParty);
  const body = await readJsonBody(request);
  const pageNonce = requirePageNonce(body.pageNonce);
  const challenge = readChallenge(
    request,
    context.userId,
    pageNonce,
    "registration",
  );
  requireRecentGoogleLogin(context);

  if (!isRegistrationResponse(body.credential)) {
    throw new PasskeyRequestError("A resposta de registro da passkey é inválida.", 400);
  }

  const verification = await verifyRegistrationResponse({
    response: body.credential,
    expectedChallenge: challenge.challenge,
    expectedOrigin: relyingParty.origin,
    expectedRPID: relyingParty.id,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new PasskeyRequestError("Não foi possível confirmar a passkey.", 400);
  }

  await consumeChallenge(context, challenge);
  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;
  const { error } = await context.database.from("user_passkeys").insert({
    credential_id: credential.id,
    user_id: context.userId,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports ?? [],
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
  });

  if (error) {
    if (error.code === "23505") {
      throw new PasskeyRequestError("Esta passkey já está cadastrada.", 409);
    }
    throw new Error(`Não foi possível salvar a passkey: ${error.message}`);
  }

  const response = Response.json({ verified: true });
  response.headers.append(
    "Set-Cookie",
    unlockedCookie(context.userId, pageNonce, relyingParty.secure),
  );
  response.headers.append(
    "Set-Cookie",
    clearCookie(challengeCookieName, relyingParty.secure),
  );
  return response;
}

export async function createAuthenticationOptions(
  request: NextRequest,
): Promise<Response> {
  const context = await getAuthContext(request);
  const relyingParty = getRelyingParty(request);
  assertSameOrigin(request, relyingParty);
  const body = await readJsonBody(request);
  const pageNonce = requirePageNonce(body.pageNonce);

  const credentials = await getCredentials(context);
  if (credentials.length === 0) {
    throw new PasskeyRequestError(
      "Ainda não há uma passkey cadastrada. Entre novamente com Google para configurá-la.",
      409,
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: relyingParty.id,
    allowCredentials: credentials.map((credential) => ({
      id: credential.credential_id,
    })),
    userVerification: "required",
  });

  await saveChallenge(context, options.challenge, pageNonce, "authentication");
  const response = Response.json({ options });
  response.headers.append(
    "Set-Cookie",
    challengeCookie(
      options.challenge,
      context.userId,
      pageNonce,
      "authentication",
      relyingParty.secure,
    ),
  );
  return response;
}

export async function verifyAuthentication(
  request: NextRequest,
): Promise<Response> {
  const context = await getAuthContext(request);
  const relyingParty = getRelyingParty(request);
  assertSameOrigin(request, relyingParty);
  const body = await readJsonBody(request);
  const pageNonce = requirePageNonce(body.pageNonce);
  const challenge = readChallenge(
    request,
    context.userId,
    pageNonce,
    "authentication",
  );

  if (!isAuthenticationResponse(body.credential)) {
    throw new PasskeyRequestError("A resposta de autenticação é inválida.", 400);
  }

  const { data: credential, error: credentialError } = await context.database
    .from("user_passkeys")
    .select("*")
    .eq("user_id", context.userId)
    .eq("credential_id", body.credential.id)
    .maybeSingle();

  if (credentialError) {
    throw new Error(`Não foi possível carregar a passkey: ${credentialError.message}`);
  }
  if (!credential) {
    throw new PasskeyRequestError("Esta passkey não pertence a esta conta.", 403);
  }

  const verification = await verifyAuthenticationResponse({
    response: body.credential,
    expectedChallenge: challenge.challenge,
    expectedOrigin: relyingParty.origin,
    expectedRPID: relyingParty.id,
    requireUserVerification: true,
    credential: {
      id: credential.credential_id,
      publicKey: new Uint8Array(Buffer.from(credential.public_key, "base64url")),
      counter: credential.counter,
    },
  });

  if (!verification.verified) {
    throw new PasskeyRequestError("A verificação do dispositivo não foi concluída.", 401);
  }

  await consumeChallenge(context, challenge);
  const { error: updateError } = await context.database
    .from("user_passkeys")
    .update({ counter: verification.authenticationInfo.newCounter })
    .eq("user_id", context.userId)
    .eq("credential_id", credential.credential_id);

  if (updateError) {
    throw new Error(`Não foi possível atualizar a passkey: ${updateError.message}`);
  }

  const response = Response.json({ verified: true });
  response.headers.append(
    "Set-Cookie",
    unlockedCookie(context.userId, pageNonce, relyingParty.secure),
  );
  response.headers.append(
    "Set-Cookie",
    clearCookie(challengeCookieName, relyingParty.secure),
  );
  return response;
}

export async function signOutPasskeySession(
  request: NextRequest,
): Promise<Response> {
  const relyingParty = getRelyingParty(request);
  assertSameOrigin(request, relyingParty);

  const response = Response.json({ signedOut: true });
  response.headers.append("Set-Cookie", clearCookie(unlockedCookieName, relyingParty.secure));
  response.headers.append("Set-Cookie", clearCookie(challengeCookieName, relyingParty.secure));
  return response;
}

export async function requireUnlockedUser(
  request: NextRequest,
): Promise<{ userId: string } | Response> {
  const context = await getAuthContext(request);
  const pageNonce = request.headers.get("x-hetu-page-nonce");
  const value = unseal(request.cookies.get(unlockedCookieName)?.value);

  if (
    !isRecord(value) ||
    value.userId !== context.userId ||
    typeof value.pageNonce !== "string" ||
    value.pageNonce !== pageNonce ||
    typeof value.expiresAt !== "number" ||
    value.expiresAt <= Date.now()
  ) {
    return Response.json(
      { error: "Desbloqueie o aplicativo com a passkey deste dispositivo." },
      { status: 401 },
    );
  }

  return { userId: context.userId };
}

export async function handlePasskeyError(
  operation: () => Promise<Response>,
  operationName = "api-protegida",
): Promise<Response> {
  try {
    const response = await operation();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof PasskeyRequestError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const reference = randomUUID();
    console.error(
      `Erro no endpoint de passkey "${operationName}" (${reference}):`,
      error,
    );
    return Response.json(
      {
        error: `Falha no servidor ao processar "${operationName}". Consulte os logs da Vercel e informe o código ${reference}.`,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export function isAuthenticatedUser(
  value: { userId: string } | Response,
): value is { userId: string } {
  return !(value instanceof Response);
}
