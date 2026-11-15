"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação. Tente novamente.";
}

export function LoginScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function initializeAuth() {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (active) {
            setUser(session?.user ?? null);
          }
        });
        unsubscribe = () => subscription.unsubscribe();

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        setUser(data.session?.user ?? null);
      } catch (authError) {
        if (active) setError(getErrorMessage(authError));
      }
    }

    void initializeAuth();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleInstallAvailable as EventListener,
    );
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleInstallAvailable as EventListener,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });

      if (authError) throw authError;
    } catch (authError) {
      setError(getErrorMessage(authError));
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    setError("");

    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut();
      if (signOutError) throw signOutError;
    } catch (signOutError) {
      setError(getErrorMessage(signOutError));
    } finally {
      setLoading(false);
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

  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-[#f7f4ed] px-5 py-10 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-[#dce4d1]/60 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-32 h-[28rem] w-[28rem] rounded-full bg-[#eadfc7]/65 blur-3xl"
      />

      <section className="relative w-full max-w-md rounded-[2rem] border border-[#e7e1d5] bg-[#fffefa]/90 px-7 py-9 text-center shadow-[0_24px_80px_rgba(54,58,43,0.10)] backdrop-blur sm:px-12 sm:py-11">
        <Image
          src="/hetu-login-logo.png"
          alt="Hetu — Rituais de cuidado"
          width={280}
          height={770}
          priority
          className="mx-auto h-[265px] w-auto object-contain sm:h-[290px]"
        />

        <div className="mx-auto mt-5 h-px w-14 bg-[#c4a765]" />
        <p className="mt-5 text-sm leading-6 text-[#77766e]">
          Um espaço para cuidar do seu negócio
          <br />
          com a mesma atenção de cada ritual.
        </p>

        {user ? (
          <div className="mt-8 rounded-2xl bg-[#f4f1ea] px-5 py-5">
            <p className="text-sm text-[#77766e]">Você está conectado como</p>
            <p className="mt-1 break-all font-medium text-[#2c3e30]">
              {user.email ?? "sua conta Google"}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loading}
              className="mt-5 text-sm font-medium text-[#536d4c] underline decoration-[#c4a765] underline-offset-4 transition hover:text-[#1e3f20] disabled:opacity-60"
            >
              {loading ? "Saindo..." : "Sair da conta"}
            </button>
          </div>
        ) : (
          <>
            <h1 className="mt-8 font-serif text-2xl text-[#2c3e30] sm:text-[1.7rem]">
              Bem-vinda ao Hetu
            </h1>
            <p className="mt-2 text-sm text-[#77766e]">
              Entre para continuar sua rotina de cuidado.
            </p>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#1e3f20] px-5 py-3.5 text-sm font-medium text-white shadow-[0_8px_20px_rgba(30,63,32,0.16)] transition hover:bg-[#294f2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4a765] disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? (
                <span
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
              ) : (
                <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
                    transform="translate(0 4)"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.61 5.9c4.44-4.1 7.16-10.14 7.16-17.55Z"
                    transform="translate(0 0)"
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
              )}
              {loading ? "Conectando com o Google..." : "Continuar com Google"}
            </button>
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

        <div className="mt-7 border-t border-[#eee9df] pt-5">
          {installPrompt ? (
            <button
              type="button"
              onClick={handleInstall}
              className="text-sm font-medium text-[#536d4c] underline decoration-[#c4a765] underline-offset-4 transition hover:text-[#1e3f20]"
            >
              Instalar Hetu no celular
            </button>
          ) : (
            <p className="text-xs leading-5 text-[#77766e]">
              No Android/Chrome, use o menu para instalar. No iPhone/iPad, abra
              no Safari, toque em Compartilhar e escolha Adicionar à Tela de
              Início.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
