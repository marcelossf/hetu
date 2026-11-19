import { getUnlockedApiHeaders } from "@/features/auth/services/auth-service";

type ProtectedRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function requestProtectedJson(
  path: string,
  accessToken: string,
  options: ProtectedRequestOptions = {},
): Promise<unknown> {
  const headers = new Headers(getUnlockedApiHeaders(accessToken));
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    credentials: "same-origin",
    cache: "no-store",
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      !Array.isArray(result) &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Não foi possível concluir a operação.";
    throw new Error(message);
  }

  return result;
}
