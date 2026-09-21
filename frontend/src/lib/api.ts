const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const AUTH_STORAGE_KEY = "expense-dashboard-auth";

interface ApiErrorPayload {
  error?: string;
}

function loadAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { token: string } | null) : null;
  } catch {
    return null;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = loadAuthSession();
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      if (payload?.error) {
        errorMessage = payload.error;
      }
    } catch {
      // ignore malformed JSON
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}
