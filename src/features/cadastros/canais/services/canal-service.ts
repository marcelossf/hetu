import { requestProtectedJson } from "@/lib/api/protected-client";

export type CanalVenda = {
  id: number;
  nome: string;
  ativo: "Sim" | "Não";
  endereco?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error("O servidor retornou um valor numérico inválido.");
  }
  return parsed;
}

export async function saveCanalVenda(
  accessToken: string,
  input: { id?: number; nome: string; endereco: string; ativo: "Sim" | "Não" },
): Promise<void> {
  await requestProtectedJson("/api/cadastros/canais", accessToken, {
    method: input.id ? "PATCH" : "POST",
    body: input,
  });
}

export async function getCanaisVenda(
  accessToken: string,
): Promise<CanalVenda[]> {
  const response = await requestProtectedJson(
    "/api/cadastros/canais",
    accessToken,
  );
  if (!isRecord(response) || !Array.isArray(response.canais)) {
    throw new Error("O servidor retornou canais inválidos.");
  }
  return response.canais.map((item): CanalVenda => {
    if (!isRecord(item) || (item.ativo !== "Sim" && item.ativo !== "Não")) {
      throw new Error("O servidor retornou um canal inválido.");
    }
    return {
      id: numberValue(item.id),
      nome: String(item.nome),
      ativo: item.ativo,
      endereco:
        typeof item.endereco === "string" ? item.endereco : null,
    };
  });
}
