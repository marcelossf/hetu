"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import {
  authenticateWithPasskey,
  getCurrentSession,
  getPasskeyStatus,
  lockCurrentPage,
  markPageUnlocked,
  registerPasskey,
  setBiometricPreference,
  signInWithGoogle,
  signOutFromHetu,
  subscribeToSession,
  supportsPasskeys,
} from "@/features/auth/services/auth-service";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type GateState = "loading" | "signed-out" | "registration" | "locked" | "unlocked";
type BusyAction = "google" | "register" | "unlock" | "settings" | "sign-out" | null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação. Tente novamente.";
}

function LoadingIndicator({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center" role="status" aria-live="polite">
      <Image
        src="/hetu-login-logo.png"
        alt="Hetu — Rituais de cuidado"
        width={280}
        height={770}
        priority
        className="animate-hetu-pulse h-auto max-h-[min(34svh,250px)] w-auto max-w-full object-contain"
      />
      <p className="mt-7 text-sm text-hetu-text/75">{label}</p>
    </div>
  );
}

export function LoginScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [pageNonce] = useState(() =>
    typeof window === "undefined" ? "" : window.crypto.randomUUID(),
  );
  const [gate, setGate] = useState<GateState>("loading");
  const [canRegisterPasskey, setCanRegisterPasskey] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const autoUnlockAttempted = useRef<string | null>(null);
  const supportsWebAuthn = useSyncExternalStore(
    () => () => {},
    supportsPasskeys,
    () => false,
  );
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function initializeAuth() {
      try {
        unsubscribe = subscribeToSession((nextSession) => {
          if (!active) return;

          if (sessionRef.current?.user.id !== nextSession?.user.id) {
            setGate("loading");
            setCanRegisterPasskey(false);
            setHasPasskey(false);
            setBiometricEnabled(true);
            setError("");
            lockCurrentPage();
          }
          sessionRef.current = nextSession;
          setSession(nextSession);
        });

        const currentSession = await getCurrentSession();
        if (active) {
          sessionRef.current = currentSession;
          setSession(currentSession);
          setAuthReady(true);
        }
      } catch (authError) {
        if (active) {
          setError(getErrorMessage(authError));
          setAuthReady(true);
          setGate("signed-out");
        }
      }
    }

    void initializeAuth();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !pageNonce) return;
    if (!session?.access_token) return;

    let active = true;
    void getPasskeyStatus(session.access_token)
      .then((status) => {
        if (!active) return;
        setCanRegisterPasskey(status.canRegisterPasskey);
        setHasPasskey(status.hasPasskey);
        setBiometricEnabled(status.biometricEnabled);
        if (status.biometricEnabled && status.hasPasskey) {
          setGate("locked");
        } else if (status.biometricEnabled && !status.hasPasskey) {
          setGate("registration");
        } else {
          markPageUnlocked(pageNonce);
          setGate("unlocked");
        }
      })
      .catch((statusError: unknown) => {
        if (!active) return;
        setError(getErrorMessage(statusError));
        setGate("locked");
      });

    return () => {
      active = false;
    };
  }, [authReady, pageNonce, session]);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => {
      setIsStandalone(
        standaloneQuery.matches ||
          ("standalone" in navigator && navigator.standalone === true),
      );
    };
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);

    updateStandalone();
    standaloneQuery.addEventListener("change", updateStandalone);
    window.addEventListener(
      "beforeinstallprompt",
      handleInstallAvailable as EventListener,
    );
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      standaloneQuery.removeEventListener("change", updateStandalone);
      window.removeEventListener(
        "beforeinstallprompt",
        handleInstallAvailable as EventListener,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleGoogleLogin() {
    setBusyAction("google");
    setError("");
    try {
      await signInWithGoogle();
    } catch (loginError) {
      setError(getErrorMessage(loginError));
      setBusyAction(null);
    }
  }

  async function handleRegisterPasskey() {
    if (!session || !pageNonce) return;

    setBusyAction("register");
    setError("");
    try {
      await registerPasskey(session.access_token, pageNonce);
      markPageUnlocked(pageNonce);
      setHasPasskey(true);
      setBiometricEnabled(true);
      setCanRegisterPasskey(false);
      setGate("unlocked");
    } catch (registrationError) {
      setError(getErrorMessage(registrationError));
    } finally {
      setBusyAction(null);
    }
  }

  const handleUnlock = useCallback(async (automatic = false) => {
    if (!session || !pageNonce) return;

    setBusyAction("unlock");
    setError("");
    try {
      await authenticateWithPasskey(session.access_token, pageNonce);
      markPageUnlocked(pageNonce);
      setGate("unlocked");
    } catch (authenticationError) {
      const isDismissed =
        authenticationError instanceof Error &&
        ["AbortError", "NotAllowedError"].includes(authenticationError.name);
      if (!automatic || !isDismissed) {
        setError(getErrorMessage(authenticationError));
      }
    } finally {
      setBusyAction(null);
    }
  }, [pageNonce, session]);

  useEffect(() => {
    if (gate !== "locked" || !session || !supportsWebAuthn) return;

    const attemptKey = `${session.user.id}:${pageNonce}`;
    if (autoUnlockAttempted.current === attemptKey) return;

    autoUnlockAttempted.current = attemptKey;
    void handleUnlock(true);
  }, [gate, handleUnlock, pageNonce, session, supportsWebAuthn]);

  async function handleSignOut(reAuthenticate = false) {
    setBusyAction(reAuthenticate ? "google" : "sign-out");
    setError("");
    try {
      await signOutFromHetu();
      if (reAuthenticate) await signInWithGoogle();
    } catch (signOutError) {
      setError(getErrorMessage(signOutError));
    } finally {
      setBusyAction(null);
    }
  }

  function handleContinueWithoutBiometric() {
    if (!pageNonce) return;
    setError("");
    markPageUnlocked(pageNonce);
    setGate("unlocked");
  }

  async function handleBiometricPreferenceChange(enabled: boolean) {
    if (!session || !pageNonce) return;

    setBusyAction(enabled ? (hasPasskey ? "unlock" : "register") : "settings");
    setError("");
    try {
      if (enabled && hasPasskey) {
        await authenticateWithPasskey(session.access_token, pageNonce);
      } else if (enabled) {
        await registerPasskey(session.access_token, pageNonce);
        setHasPasskey(true);
        setCanRegisterPasskey(false);
        markPageUnlocked(pageNonce);
        setBiometricEnabled(true);
        return;
      }

      if (enabled) markPageUnlocked(pageNonce);
      await setBiometricPreference(session.access_token, pageNonce, enabled);
      setBiometricEnabled(enabled);
      if (!enabled) {
        markPageUnlocked(pageNonce);
        if (gate === "locked") setGate("unlocked");
      }
    } catch (preferenceError) {
      setError(getErrorMessage(preferenceError));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleInstall() {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (installError) {
      setError(getErrorMessage(installError));
    }
  }

  const visibleGate =
    authReady && (!session || !session.access_token) ? "signed-out" : gate;
  const isLoading =
    visibleGate === "loading" ||
    busyAction === "register" ||
    busyAction === "unlock";
  const loadingLabel =
    busyAction === "register"
      ? "Preparando a verificação biométrica..."
      : busyAction === "unlock"
        ? "Aguardando a verificação do dispositivo..."
        : "Verificando sua sessão...";

  if (visibleGate === "unlocked" && session) {
    return (
      <AuthenticatedApp
        email={session.user.email ?? ""}
        biometricEnabled={biometricEnabled}
        hasPasskey={hasPasskey}
        supportsWebAuthn={supportsWebAuthn}
        busy={busyAction !== null}
        error={error}
        isStandalone={isStandalone}
        onBiometricPreferenceChange={handleBiometricPreferenceChange}
        onSignOut={() => handleSignOut()}
        onClearError={() => setError("")}
      />
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-x-hidden bg-hetu-cream px-5 py-4 sm:px-8 sm:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-hetu-green/[0.07] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-32 h-[28rem] w-[28rem] rounded-full bg-hetu-gold/[0.12] blur-3xl"
      />

      <section
        aria-label="Autenticação Hetu"
        className="relative w-full max-w-md rounded-[2rem] border border-hetu-green/10 bg-white/90 px-6 py-5 text-center shadow-[0_24px_80px_rgba(42,42,42,0.10)] backdrop-blur sm:px-12 sm:py-10"
      >
        {isLoading ? (
          <LoadingIndicator label={loadingLabel} />
        ) : (
          <>
            <Image
              src="/hetu-login-logo.png"
              alt="Hetu — Rituais de cuidado"
              width={280}
              height={770}
              priority
              className="mx-auto h-auto max-h-[min(34svh,250px)] w-auto max-w-full object-contain"
            />
            <div className="mx-auto mt-5 h-px w-14 bg-hetu-gold" />

            {visibleGate === "signed-out" && (
              <>
                <h1 className="mt-7 font-serif text-2xl text-hetu-green sm:text-[1.7rem]">
                  Bem-vinda à Hetu
                </h1>
                <p className="mt-2 text-sm text-hetu-text/70">
                  Entre com Google para continuar sua rotina de cuidado.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={busyAction !== null}
                  className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-hetu-green px-5 py-3.5 text-sm font-medium text-white shadow-[0_8px_20px_rgba(31,61,43,0.16)] transition hover:bg-hetu-green/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hetu-gold disabled:cursor-wait disabled:opacity-70"
                >
                  {busyAction === "google" ? (
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                  ) : (
                    <GoogleIcon />
                  )}
                  {busyAction === "google"
                    ? "Conectando com o Google..."
                    : "Continuar com Google"}
                </button>
              </>
            )}

            {visibleGate === "registration" && (
              <>
                <h1 className="mt-7 font-serif text-2xl text-hetu-green">
                  Proteja seu acesso
                </h1>
                <p className="mt-2 text-sm leading-6 text-hetu-text/70">
                  Ative uma credencial segura neste dispositivo. Ele poderá
                  solicitar biometria ou, conforme suas configurações, o PIN
                  ou bloqueio de tela.
                </p>
                <button
                  type="button"
                  onClick={handleRegisterPasskey}
                  disabled={
                    !supportsWebAuthn ||
                    busyAction !== null
                  }
                  className="mt-7 min-h-14 w-full rounded-xl bg-hetu-green px-5 py-3.5 text-sm font-medium text-white transition hover:bg-hetu-green/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hetu-gold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ativar biometria neste dispositivo
                </button>
                <button
                  type="button"
                  onClick={handleContinueWithoutBiometric}
                  disabled={busyAction !== null}
                  className="mt-4 block w-full text-sm text-hetu-text/70 underline underline-offset-4 disabled:opacity-60"
                >
                  Continuar sem ativar agora
                </button>
                {!canRegisterPasskey && (
                  <p className="mt-3 text-xs leading-5 text-hetu-text/65">
                    Para ativar, confirme novamente sua conta Google pelo botão
                    abaixo.
                  </p>
                )}
                {!supportsWebAuthn && (
                  <p className="mt-3 text-xs leading-5 text-hetu-text/65">
                    Este navegador não oferece passkeys. Abra o Hetu em um
                    navegador atualizado e seguro.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => handleSignOut(true)}
                  disabled={busyAction !== null}
                  className="mt-5 text-sm font-medium text-hetu-green underline decoration-hetu-gold underline-offset-4 disabled:opacity-60"
                >
                  {busyAction === "google"
                    ? "Abrindo Google..."
                    : "Entrar novamente com Google"}
                </button>
              </>
            )}

            {visibleGate === "locked" && (
              <>
                <h1 className="mt-7 font-serif text-2xl text-hetu-green">
                  Confirme sua identidade
                </h1>
                <p className="mt-2 break-all text-sm text-hetu-text/70">
                  {session?.user.email}
                </p>
                <button
                  type="button"
                  onClick={() => void handleUnlock()}
                  disabled={!supportsWebAuthn || busyAction !== null}
                  className="mt-7 min-h-14 w-full rounded-xl bg-hetu-green px-5 py-3.5 text-sm font-medium text-white transition hover:bg-hetu-green/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hetu-gold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Desbloquear com biometria
                </button>
                <p className="mt-3 text-xs leading-5 text-hetu-text/65">
                  O dispositivo pode solicitar biometria ou, conforme suas
                  configurações, o PIN/bloqueio de tela. Se o pedido automático
                  não aparecer, toque no botão para tentar novamente.
                </p>
                {!supportsWebAuthn && (
                  <p className="mt-3 text-xs leading-5 text-hetu-text/65">
                    Este navegador não oferece passkeys. Tente em um navegador
                    atualizado ou entre novamente com Google para configurar
                    outro dispositivo.
                  </p>
                )}
                {canRegisterPasskey && supportsWebAuthn && (
                  <button
                    type="button"
                    onClick={handleRegisterPasskey}
                    disabled={busyAction !== null}
                    className="mt-4 text-sm font-medium text-hetu-green underline decoration-hetu-gold underline-offset-4 disabled:opacity-60"
                  >
                    Ativar biometria neste dispositivo
                  </button>
                )}
                {canRegisterPasskey && (
                  <button
                    type="button"
                    onClick={() => void handleBiometricPreferenceChange(false)}
                    disabled={busyAction !== null}
                    className="mt-5 block w-full text-sm text-hetu-green underline underline-offset-4 disabled:opacity-60"
                  >
                    Continuar com Google e desativar biometria na conta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSignOut(true)}
                  disabled={busyAction !== null}
                  className="mt-4 block w-full text-sm text-hetu-text/65 underline underline-offset-4 disabled:opacity-60"
                >
                  {busyAction === "google"
                    ? "Abrindo Google..."
                    : "Entrar novamente com Google"}
                </button>
              </>
            )}

            {visibleGate === "unlocked" && (
              <div className="mt-7 rounded-2xl bg-hetu-cream px-5 py-5">
                <h1 className="font-serif text-xl text-hetu-green">
                  Dispositivo verificado
                </h1>
                <p className="mt-2 text-sm leading-6 text-hetu-text/70">
                  Sua identidade foi confirmada. A experiência interna do
                  sistema será construída na próxima etapa.
                </p>
                <p className="mt-3 break-all text-xs text-hetu-text/60">
                  {session?.user.email}
                </p>
                <button
                  type="button"
                  onClick={() => handleSignOut()}
                  disabled={busyAction !== null}
                  className="mt-5 text-sm font-medium text-hetu-green underline decoration-hetu-gold underline-offset-4 disabled:opacity-60"
                >
                  {busyAction === "sign-out" ? "Saindo..." : "Sair da conta"}
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {!isLoading && isStandalone === false && (
          <div className="mt-7 border-t border-hetu-green/10 pt-5">
            {installPrompt ? (
              <button
                type="button"
                onClick={handleInstall}
                className="text-sm font-medium text-hetu-green underline decoration-hetu-gold underline-offset-4"
              >
                Instalar Hetu no celular
              </button>
            ) : (
              <p className="text-xs leading-5 text-hetu-text/65">
                No Android/Chrome, use o menu para instalar. No iPhone/iPad,
                abra no Safari, toque em Compartilhar e escolha Adicionar à Tela
                de Início.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

type AuthenticatedAppProps = {
  email: string;
  biometricEnabled: boolean;
  hasPasskey: boolean;
  supportsWebAuthn: boolean;
  busy: boolean;
  error: string;
  isStandalone: boolean | null;
  onBiometricPreferenceChange: (enabled: boolean) => void;
  onSignOut: () => void;
  onClearError: () => void;
};

function AuthenticatedApp({
  email,
  biometricEnabled,
  hasPasskey,
  supportsWebAuthn,
  busy,
  error,
  isStandalone,
  onBiometricPreferenceChange,
  onSignOut,
  onClearError,
}: AuthenticatedAppProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeView, setActiveView] = useState<"home" | "settings">("home");

  return (
    <div className="flex min-h-dvh bg-hetu-cream text-hetu-text">
      <aside
        className={`flex shrink-0 flex-col border-r border-hetu-green/10 bg-white px-3 py-5 transition-[width] ${
          sidebarExpanded ? "w-64" : "w-[4.5rem]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          {sidebarExpanded && (
            <span className="pl-2 font-serif text-lg text-hetu-green">Hetu</span>
          )}
          <button
            type="button"
            aria-label={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
            aria-expanded={sidebarExpanded}
            onClick={() => setSidebarExpanded((expanded) => !expanded)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-hetu-green hover:bg-hetu-cream focus-visible:outline-2 focus-visible:outline-hetu-gold"
          >
            <MenuIcon />
          </button>
        </div>

        <nav aria-label="Menu principal" className="mt-8 flex flex-col gap-2">
          <SidebarButton
            label="Visão geral"
            expanded={sidebarExpanded}
            active={activeView === "home"}
            onClick={() => setActiveView("home")}
          >
            <HomeIcon />
          </SidebarButton>
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-hetu-green/10 pt-4">
          <button
            type="button"
            onClick={onSignOut}
            disabled={busy}
            title={sidebarExpanded ? undefined : "Sair da conta"}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm text-hetu-text/70 hover:bg-hetu-cream disabled:opacity-50 ${
              sidebarExpanded ? "w-full" : "w-11 justify-center"
            }`}
          >
            <SignOutIcon />
            {sidebarExpanded && <span>Sair da conta</span>}
          </button>
          <SidebarButton
            label="Configurações"
            expanded={sidebarExpanded}
            active={activeView === "settings"}
            onClick={() => setActiveView("settings")}
          >
            <SettingsIcon />
          </SidebarButton>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 sm:px-10 sm:py-9">
        <header className="mb-8 border-b border-hetu-green/10 pb-5">
          <p className="text-sm text-hetu-text/60">{email}</p>
          <h1 className="mt-1 font-serif text-2xl text-hetu-green">
            {activeView === "settings" ? "Configurações" : "Visão geral"}
          </h1>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={onClearError}
              aria-label="Fechar mensagem de erro"
              className="font-semibold"
            >
              ×
            </button>
          </div>
        )}

        {activeView === "home" ? (
          <section className="rounded-2xl border border-hetu-green/10 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="font-serif text-xl text-hetu-green">
              Bem-vinda à Hetu
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-hetu-text/70">
              Seu acesso está ativo. Os módulos de gestão serão adicionados
              nesta área nas próximas etapas.
            </p>
            {isStandalone === false && (
              <p className="mt-4 text-xs leading-5 text-hetu-text/60">
                Você pode instalar o Hetu pelo menu do navegador para acessá-lo
                como aplicativo.
              </p>
            )}
          </section>
        ) : (
          <section className="max-w-3xl rounded-2xl border border-hetu-green/10 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="font-serif text-xl text-hetu-green">
              Acesso e segurança
            </h2>
            <p className="mt-2 text-sm leading-6 text-hetu-text/70">
              A preferência vale para toda a sua conta e será aplicada nos
              dispositivos em que você entrar.
            </p>

            <label className="mt-7 flex cursor-pointer items-center justify-between gap-5 rounded-xl bg-hetu-cream p-4 sm:p-5">
              <span>
                <span className="block font-medium text-hetu-text">
                  Usar biometria ao entrar
                </span>
                <span className="mt-1 block text-sm leading-5 text-hetu-text/65">
                  {hasPasskey
                    ? "Quando ativada, a verificação do dispositivo será solicitada ao abrir o app."
                    : biometricEnabled
                      ? "Preferência ativada, mas ainda sem passkey. Cadastre uma neste dispositivo ou continue sem biometria."
                      : "Ativar vai cadastrar uma passkey neste dispositivo; a preferência vale para toda a conta."}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={biometricEnabled}
                disabled={busy || (!supportsWebAuthn && !biometricEnabled)}
                onChange={(event) =>
                  onBiometricPreferenceChange(event.currentTarget.checked)
                }
                className="h-6 w-11 shrink-0 cursor-pointer accent-hetu-green disabled:cursor-not-allowed"
                aria-label="Usar biometria ao entrar"
              />
            </label>

            {!hasPasskey && (
              <button
                type="button"
                onClick={() => onBiometricPreferenceChange(true)}
                disabled={busy || !supportsWebAuthn}
                className="mt-4 min-h-11 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ativar biometria neste dispositivo
              </button>
            )}

            {!supportsWebAuthn && !biometricEnabled && (
              <p className="mt-3 text-xs leading-5 text-hetu-text/60">
                Para ativar a biometria, abra o Hetu em um navegador atualizado
                e compatível com passkeys.
              </p>
            )}
            {hasPasskey && (
              <p className="mt-4 text-xs leading-5 text-hetu-text/60">
                O dispositivo pode solicitar biometria ou, conforme suas
                configurações, o PIN/bloqueio de tela.
              </p>
            )}
            {busy && (
              <p className="mt-4 text-sm text-hetu-text/65" role="status">
                Atualizando a configuração de segurança...
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function SidebarButton({
  label,
  expanded,
  active,
  onClick,
  children,
}: {
  label: string;
  expanded: boolean;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={expanded ? undefined : label}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm ${
        expanded ? "w-full" : "w-11 justify-center"
      } ${
        active
          ? "bg-hetu-green text-white"
          : "text-hetu-text/75 hover:bg-hetu-cream"
      }`}
    >
      {children}
      {expanded && <span>{label}</span>}
    </button>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <path d="m3.5 10 8.5-7 8.5 7v10.5h-6v-6h-5v6h-6V10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="m19.4 13.5 1.1.9-1.6 2.8-1.4-.5a7.8 7.8 0 0 1-1.5.9l-.2 1.5h-3.3l-.2-1.5a7.8 7.8 0 0 1-1.5-.9l-1.4.5-1.6-2.8 1.1-.9a7.4 7.4 0 0 1 0-1.8l-1.1-.9 1.6-2.8 1.4.5a7.8 7.8 0 0 1 1.5-.9l.2-1.5h3.3l.2 1.5a7.8 7.8 0 0 1 1.5.9l1.4-.5 1.6 2.8-1.1.9a7.4 7.4 0 0 1 0 1.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <path d="M10 4H5.5v16H10M14 8l4 4-4 4m4-4H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
        transform="translate(0 4)"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.61 5.9c4.44-4.1 7.16-10.14 7.16-17.55Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z"
        transform="translate(0 4)"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.61-5.9c-2.12 1.42-4.84 2.26-8.29 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
        transform="translate(0 -4)"
      />
    </svg>
  );
}
