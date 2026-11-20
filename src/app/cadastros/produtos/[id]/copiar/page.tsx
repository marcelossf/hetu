import { Suspense } from "react";
import { LoginScreen } from "@/features/auth/components/login-screen";

export default function CopiarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-hetu-cream" />}>
      {params.then(({ id }) => (
        <LoginScreen initialView="produto-form" initialCopyFichaId={id} />
      ))}
    </Suspense>
  );
}
