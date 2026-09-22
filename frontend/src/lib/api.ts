import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { loadAuthSession, saveAuthSession } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const apiClient = axios.create({
  baseURL: API_BASE || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const session = loadAuthSession();

  if (session?.token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${session.token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      const session = loadAuthSession();
      if (session) {
        saveAuthSession(null);
      }
    }

    return Promise.reject(error);
  }
);

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
  const context = getRequestContext(path);
  const { body, headers, method } = options as RequestInit & { body?: BodyInit | null };

  const requestHeaders =
    Array.isArray(headers)
      ? Object.fromEntries(headers)
      : headers instanceof Headers
        ? Object.fromEntries(headers.entries())
        : ((headers as Record<string, string> | undefined) ?? {});

  const session = loadAuthSession();

  if (session?.token) {
    requestHeaders.Authorization = `Bearer ${session.token}`;
  }

  try {
    const response = await apiClient.request<T>({
      method,
      url: path,
      data: body,
      headers: requestHeaders,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0;
      let message = getFriendlyErrorMessageByStatus(status, context);

      const data = error.response?.data as ApiErrorPayload | undefined;
      if (data && (data.error || data.message)) {
        message = data.error ?? data.message ?? message;
      }

      throw new Error(message);
    }

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
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
