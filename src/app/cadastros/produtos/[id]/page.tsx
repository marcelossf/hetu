import { Suspense } from "react";
import { LoginScreen } from "@/features/auth/components/login-screen";

export default function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-hetu-cream" />}>
      {params.then(({ id }) => (
        <LoginScreen initialView="produto-form" initialFichaId={id} />
      ))}
    </Suspense>
  );
}
