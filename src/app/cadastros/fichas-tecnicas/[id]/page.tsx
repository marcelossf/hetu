import { LoginScreen } from "@/features/auth/components/login-screen";

export default function FichaEditPage({ params }: { params: { id: string } }) {
  return <LoginScreen initialView="ficha-edit" initialFichaId={params.id} />;
}
