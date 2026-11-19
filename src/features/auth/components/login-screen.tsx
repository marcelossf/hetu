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
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  Boxes,
  Factory,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  X,
} from "lucide-react";
import {
  authenticateWithPasskey,
  getCurrentSession,
  getOrCreatePageNonce,
  getPasskeyStatus,
  lockCurrentPage,
  markPageUnlocked,
  registerPasskey,
  rotatePageNonce,
  setBiometricPreference,
  signInWithGoogle,
  signOutFromHetu,
  subscribeToSession,
  supportsPasskeys,
} from "@/features/auth/services/auth-service";
import { CategoriasInsumoScreen } from "@/features/cadastros/categorias/components/categorias-insumo-screen";
import { InsumosScreen } from "@/features/cadastros/insumos/components/insumos-screen";
import { ProducaoScreen } from "@/features/producao/components/producao-screen";
import { ProdutosScreen } from "@/features/produtos/components/produtos-screen";
import { FichasTecnicasScreen } from "@/features/produtos/components/fichas-tecnicas-screen";
import { CategoriasProdutosScreen } from "@/features/produtos/components/categorias-produtos-screen";
import { CanaisVendaScreen } from "@/features/cadastros/canais/components/canais-venda-screen";
import { VendasScreen } from "@/features/vendas/components/vendas-screen";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";

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

type PageNonceState = {
  value: string;
  error: string;
};

function createPageNonceState(reuse: boolean): PageNonceState {
  if (typeof window === "undefined") return { value: "", error: "" };
  try {
    return {
      value: reuse ? getOrCreatePageNonce() : rotatePageNonce(),
      error: "",
    };
  } catch (storageError) {
    return {
      value: window.crypto.randomUUID(),
      error: `Não foi possível preservar a sessão deste navegador após uma atualização. ${
        getErrorMessage(storageError)
      }`,
    };
  }
}

export type AppView =
  | "home"
  | "insumos"
  | "categorias-insumo"
  | "canais"
  | "produtos"
  | "fichas-tecnicas"
  | "categorias-produtos"
  | "ficha-edit"
  | "producao"
  | "vendas"
  | "settings";

export function LoginScreen({
  initialView = "home",
}: {
  initialView?: AppView;
  initialFichaId?: string;
} = {}) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [pageNonceState, setPageNonceState] = useState(() =>
    createPageNonceState(true),
  );
  const pageNonce = pageNonceState.value;
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
  const [isPullToRefresh, setIsPullToRefresh] = useState(false);

  // Prevent biometric prompt on pull-to-refresh
  usePullToRefresh({
    onPullToRefresh: () => {
      setIsPullToRefresh(true);
      setTimeout(() => setIsPullToRefresh(false), 1000);
    },
  });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function initializeAuth() {
      try {
        unsubscribe = subscribeToSession((event, nextSession) => {
          if (!active) return;

          if (
            event !== "INITIAL_SESSION" &&
            sessionRef.current?.user.id !== nextSession?.user.id
          ) {
            setGate("loading");
            setCanRegisterPasskey(false);
            setHasPasskey(false);
            setBiometricEnabled(true);
            setError("");
            lockCurrentPage();
            setPageNonceState(createPageNonceState(false));
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
    void getPasskeyStatus(session.access_token, pageNonce)
      .then((status) => {
        if (!active) return;
        setCanRegisterPasskey(status.canRegisterPasskey);
        setHasPasskey(status.hasPasskey);
        setBiometricEnabled(status.biometricEnabled);
        if (status.biometricEnabled && status.hasPasskey) {
          if (status.unlocked) {
            markPageUnlocked(pageNonce);
            setGate("unlocked");
          } else {
            setGate("locked");
          }
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
    if (gate !== "locked" || !session || !supportsWebAuthn || isPullToRefresh) return;

    const attemptKey = `${session.user.id}:${pageNonce}`;
    if (autoUnlockAttempted.current === attemptKey) return;

    autoUnlockAttempted.current = attemptKey;
    void handleUnlock(true);
  }, [gate, handleUnlock, pageNonce, session, supportsWebAuthn, isPullToRefresh]);

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
  const visibleError = error || pageNonceState.error;
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
        accessToken={session.access_token}
        email={session.user.email ?? ""}
        biometricEnabled={biometricEnabled}
        hasPasskey={hasPasskey}
        supportsWebAuthn={supportsWebAuthn}
        busy={busyAction !== null}
        error={visibleError}
        isStandalone={isStandalone}
        initialView={initialView}
        onBiometricPreferenceChange={handleBiometricPreferenceChange}
        onSignOut={() => handleSignOut()}
        onClearError={() => {
          setError("");
          setPageNonceState((current) => ({ ...current, error: "" }));
        }}
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
                  {busyAction === "google" && (
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
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

        {visibleError && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800"
          >
            {visibleError}
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
  accessToken: string;
  email: string;
  biometricEnabled: boolean;
  hasPasskey: boolean;
  supportsWebAuthn: boolean;
  busy: boolean;
  error: string;
  isStandalone: boolean | null;
  initialView: AppView;
  onBiometricPreferenceChange: (enabled: boolean) => void;
  onSignOut: () => void;
  onClearError: () => void;
};

function AuthenticatedApp({
  accessToken,
  email,
  biometricEnabled,
  hasPasskey,
  supportsWebAuthn,
  busy,
  error,
  isStandalone,
  initialView,
  onBiometricPreferenceChange,
  onSignOut,
  onClearError,
}: AuthenticatedAppProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(initialView);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  function startSidebarSwipe(event: ReactPointerEvent<HTMLElement>) {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  }

  function finishSidebarSwipe(event: ReactPointerEvent<HTMLElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!sidebarExpanded || !start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX < -70 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setSidebarExpanded(false);
    }
  }

  return (
    <div className="flex min-h-dvh bg-hetu-cream text-hetu-text">
      {!sidebarExpanded && (
        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={false}
          onClick={() => setSidebarExpanded(true)}
          className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-hetu-green/10 bg-white text-hetu-green shadow-sm hover:bg-hetu-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hetu-gold"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      )}

      {sidebarExpanded && (
        <aside
          aria-label="Menu principal"
          aria-modal="true"
          role="dialog"
          onPointerDown={startSidebarSwipe}
          onPointerUp={finishSidebarSwipe}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
          className="fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-y-auto bg-white px-5 py-5 touch-pan-y sm:px-8"
        >
          <div className="flex items-center justify-between border-b border-hetu-green/10 pb-4">
            <span className="pl-2 font-serif text-xl text-hetu-green">Hetu</span>
            <button
              type="button"
              aria-label="Fechar menu"
              aria-expanded={true}
              onClick={() => setSidebarExpanded(false)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-hetu-green hover:bg-hetu-cream focus-visible:outline-2 focus-visible:outline-hetu-gold"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <nav
            aria-label="Navegação"
            className="mx-auto mt-5 flex w-full max-w-3xl flex-col gap-5"
          >
            <SidebarGroup label="Visão geral">
              <SidebarButton
                label="Início"
                expanded={true}
                active={activeView === "home"}
                onClick={() => {
                  setActiveView("home");
                  setSidebarExpanded(false);
                }}
              >
                <Home aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
            </SidebarGroup>

            <SidebarGroup label="Cadastros">
              <SidebarButton
                label="Insumos"
                expanded={true}
                active={activeView === "insumos"}
                onClick={() => {
                  setActiveView("insumos");
                  setSidebarExpanded(false);
                }}
              >
                <Package aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
              <SidebarButton
                label="Categorias de insumo"
                expanded={true}
                active={activeView === "categorias-insumo"}
                onClick={() => {
                  setActiveView("categorias-insumo");
                  setSidebarExpanded(false);
                }}
              >
                <Tags aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
              <SidebarButton
                label="Canais de venda"
                expanded={true}
                active={activeView === "canais"}
                onClick={() => {
                  setActiveView("canais");
                  setSidebarExpanded(false);
                }}
              >
                <Store aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
            </SidebarGroup>

            <SidebarGroup label="Produtos">
              <SidebarButton
                label="Produtos"
                expanded={true}
                active={activeView === "produtos"}
                onClick={() => {
                  setActiveView("produtos");
                  setSidebarExpanded(false);
                }}
              >
                <Boxes aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
              <SidebarButton
                label="Fichas técnicas"
                expanded={true}
                active={activeView === "fichas-tecnicas"}
                onClick={() => {
                  setActiveView("fichas-tecnicas");
                  setSidebarExpanded(false);
                }}
              >
                <Boxes aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
              <SidebarButton
                label="Categorias de produtos"
                expanded={true}
                active={activeView === "categorias-produtos"}
                onClick={() => {
                  setActiveView("categorias-produtos");
                  setSidebarExpanded(false);
                }}
              >
                <Tags aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
            </SidebarGroup>

            <SidebarGroup label="Operações">
              <SidebarButton
                label="Produção"
                expanded={true}
                active={activeView === "producao"}
                onClick={() => {
                  setActiveView("producao");
                  setSidebarExpanded(false);
                }}
              >
                <Factory aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
              <SidebarButton
                label="Vendas"
                expanded={true}
                active={activeView === "vendas"}
                onClick={() => {
                  setActiveView("vendas");
                  setSidebarExpanded(false);
                }}
              >
                <ShoppingCart aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
            </SidebarGroup>

            <SidebarGroup label="Conta">
              <SidebarButton
                label="Configurações"
                expanded={true}
                active={activeView === "settings"}
                onClick={() => {
                  setActiveView("settings");
                  setSidebarExpanded(false);
                }}
              >
                <Settings aria-hidden="true" className="h-5 w-5 shrink-0" />
              </SidebarButton>
              <button
                type="button"
                onClick={onSignOut}
                disabled={busy}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-hetu-text/70 hover:bg-hetu-cream disabled:opacity-50"
              >
                <LogOut aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span>Sair da conta</span>
              </button>
            </SidebarGroup>
          </nav>
          <p className="mx-auto mt-6 w-full max-w-3xl pb-3 text-center text-xs text-hetu-text/50">
            Deslize para a esquerda para fechar
          </p>
        </aside>
      )}

      <main
        inert={sidebarExpanded}
        className="min-w-0 flex-1 px-5 pb-6 pt-20 sm:px-10 sm:pb-9"
      >
        <header className="mb-8 border-b border-hetu-green/10 pb-5">
          <p className="text-sm text-hetu-text/60">{email}</p>
          <h1 className="mt-1 font-serif text-2xl text-hetu-green">
            {activeView === "settings"
              ? "Configurações"
              : activeView === "insumos"
                ? "Insumos"
                : activeView === "categorias-insumo"
                  ? "Categorias de insumo"
                  : activeView === "canais"
                    ? "Canais de venda"
                    : activeView === "produtos"
                      ? "Produtos"
                      : activeView === "fichas-tecnicas"
                        ? "Fichas técnicas"
                        : activeView === "categorias-produtos"
                          ? "Categorias de produtos"
                          : activeView === "ficha-edit"
                            ? "Editar ficha técnica"
                            : activeView === "producao"
                              ? "Produção"
                              : activeView === "vendas"
                                ? "Vendas"
                                : "Visão geral"}
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
              Seu acesso está ativo. Use o menu para organizar cadastros,
              produtos, produção e vendas.
            </p>
            {isStandalone === false && (
              <p className="mt-4 text-xs leading-5 text-hetu-text/60">
                Você pode instalar o Hetu pelo menu do navegador para acessá-lo
                como aplicativo.
              </p>
            )}
          </section>
        ) : activeView === "insumos" ? (
          <InsumosScreen
            accessToken={accessToken}
            onOpenCategories={() => {
              setActiveView("categorias-insumo");
              setSidebarExpanded(false);
            }}
          />
        ) : activeView === "categorias-insumo" ? (
          <CategoriasInsumoScreen accessToken={accessToken} />
        ) : activeView === "canais" ? (
          <CanaisVendaScreen accessToken={accessToken} />
        ) : activeView === "produtos" ? (
          <ProdutosScreen accessToken={accessToken} />
        ) : activeView === "fichas-tecnicas" ? (
          <FichasTecnicasScreen accessToken={accessToken} />
        ) : activeView === "categorias-produtos" ? (
          <CategoriasProdutosScreen accessToken={accessToken} />
        ) : activeView === "ficha-edit" ? (
          <div className="text-sm text-hetu-text/65">
            Página de edição de ficha técnica. Implementar com rota dinâmica.
          </div>
        ) : activeView === "producao" ? (
          <ProducaoScreen accessToken={accessToken} />
        ) : activeView === "vendas" ? (
          <VendasScreen accessToken={accessToken} />
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

function SidebarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-hetu-text/50">
        {label}
      </h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}
