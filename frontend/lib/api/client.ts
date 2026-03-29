export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function readTokenFromCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("auth_token="));

  if (!entry) {
    return null;
  }

  return entry.split("=").slice(1).join("=") || null;
}

function writeTokenCookie(token: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `auth_token=${token}; Path=/; Max-Age=604800; SameSite=Lax`;
}

function clearTokenCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = "auth_token=; Path=/; Max-Age=0; SameSite=Lax";
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const localStorageToken = localStorage.getItem("auth_token");
  if (localStorageToken) {
    return localStorageToken;
  }

  return readTokenFromCookie();
}

export function hasAuthToken(): boolean {
  return !!getAuthToken();
}

export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }

  writeTokenCookie(token);
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }

  clearTokenCookie();
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearAuthToken();
      window.location.href = "/login";
    }

    const contentType = response.headers.get("content-type") || "";
    let message = "Something went wrong";

    if (contentType.includes("application/json")) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      message = errorData.message || message;
    } else {
      const errorText = await response.text().catch(() => "");
      if (errorText) {
        message = errorText;
      }
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
}
