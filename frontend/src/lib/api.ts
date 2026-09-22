import { loadAuthSession } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

type RequestContext =
  | "login"
  | "register"
  | "transactions"
  | "categories"
  | "dashboard"
  | "summary"
  | "trends"
  | "generic";

function getRequestContext(path: string): RequestContext {
  if (path.startsWith("/api/auth/login")) {
    return "login";
  }

  if (path.startsWith("/api/auth/register")) {
    return "register";
  }

  if (path.startsWith("/api/transactions")) {
    return "transactions";
  }

  if (path.startsWith("/api/categories")) {
    return "categories";
  }

  if (path.startsWith("/api/dashboard")) {
    return "dashboard";
  }

  if (path.startsWith("/api/summary")) {
    return "summary";
  }

  if (path.startsWith("/api/trends")) {
    return "trends";
  }

  return "generic";
}

function getFriendlyErrorMessageByStatus(status: number, context: RequestContext) {
  if (status === 400) {
    if (context === "login" || context === "register") {
      return "Please check your email and password and try again.";
    }

    return "Please check your input and try again.";
  }

  if (status === 401) {
    if (context === "login") {
      return "Email or password is incorrect.";
    }

    return "Your session may have expired. Please sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (status === 404) {
    if (context === "transactions") {
      return "We could not find that transaction.";
    }

    if (context === "categories") {
      return "We could not find that category.";
    }

    return "We could not find what you requested.";
  }

  if (status === 409) {
    if (context === "register") {
      return "An account with this email already exists.";
    }

    return "This record already exists or was changed. Please refresh and try again.";
  }

  if (status >= 500) {
    if (context === "dashboard" || context === "summary" || context === "trends") {
      return "We could not load your dashboard right now. Please try again in a moment.";
    }

    if (context === "transactions") {
      return "We could not save your transaction right now. Please try again.";
    }

    if (context === "categories") {
      return "We could not update categories right now. Please try again.";
    }

    if (context === "login" || context === "register") {
      return "We could not complete sign in right now. Please try again.";
    }

    return "Something went wrong on our side. Please try again in a moment.";
  }

  return "Something went wrong. Please try again.";
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = loadAuthSession();
  const context = getRequestContext(path);
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    if (context === "dashboard" || context === "summary" || context === "trends") {
      throw new Error("Unable to load your dashboard right now. Please check your connection and try again.");
    }

    if (context === "transactions") {
      throw new Error("Unable to save your transaction right now. Please check your connection and try again.");
    }

    if (context === "categories") {
      throw new Error("Unable to update categories right now. Please check your connection and try again.");
    }

    if (context === "login" || context === "register") {
      throw new Error("Unable to complete sign in right now. Please check your connection and try again.");
    }

    throw new Error("Unable to connect right now. Please check your internet connection and try again.");
  }

  if (!response.ok) {
    let message = getFriendlyErrorMessageByStatus(response.status, context);

    try {
      const data = (await response.json()) as ApiErrorPayload;
      if (data?.error || data?.message) {
        message = data.error ?? data.message ?? message;
      }
    } catch {
      // ignore malformed JSON
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

