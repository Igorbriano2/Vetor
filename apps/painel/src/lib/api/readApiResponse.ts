export class ApiResponseError extends Error {}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  let payload: unknown = null;
  if (contentType.includes("application/json")) {
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new ApiResponseError("O Vetor retornou uma resposta inválida. Tente novamente.");
    }
  } else {
    throw new ApiResponseError(
      response.status === 401
        ? "Sua sessão expirou. Entre novamente para continuar."
        : `O Vetor não respondeu corretamente (status ${response.status}). Tente novamente.`,
    );
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "Falha na comunicação com o Vetor.";
    throw new ApiResponseError(message);
  }

  return payload as T;
}
