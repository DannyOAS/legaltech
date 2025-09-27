const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
  skipAuthRefresh?: boolean;
}

export interface ApiErrorShape {
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  payload: ApiErrorShape;

  constructor(status: number, payload: ApiErrorShape) {
    super(payload.detail || `API error ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const match = document.cookie.match(/mlp_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

let refreshPromise: Promise<void> | null = null;

async function refreshAuth(): Promise<void> {
  if (!refreshPromise) {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    const csrf = getCsrfToken();
    if (csrf) {
      headers["X-CSRFToken"] = csrf;
    }
    refreshPromise = fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          const data = contentType && contentType.includes("application/json") ? await response.json() : await response.text();
          throw new ApiError(response.status, typeof data === "string" ? { status: response.status, detail: data } : data);
        }
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: HeadersInit = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (method !== "GET" && method !== "HEAD") {
    const csrf = getCsrfToken();
    if (csrf) {
      headers["X-CSRFToken"] = csrf;
    }
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });
  const contentType = response.headers.get("content-type");
  const data = contentType && contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 && !options.skipAuthRefresh && !path.startsWith("/auth/")) {
      try {
        await refreshAuth();
        return request<T>(path, { ...options, skipAuthRefresh: true });
      } catch (refreshError) {
        if (refreshError instanceof ApiError) {
          throw refreshError;
        }
        throw refreshError;
      }
    }
    throw new ApiError(response.status, typeof data === "string" ? { status: response.status, detail: data } : data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
