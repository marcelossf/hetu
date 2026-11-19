import { LoginScreen } from "@/features/auth/components/login-screen";

export default async function FichaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LoginScreen initialView="ficha-edit" initialFichaId={id} />;
}
