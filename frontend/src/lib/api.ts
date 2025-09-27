const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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

async function request<T>(path: string, options: { method?: HttpMethod; body?: unknown; headers?: HeadersInit } = {}): Promise<T> {
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
