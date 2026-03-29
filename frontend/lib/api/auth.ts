import { apiClient, clearAuthToken, setAuthToken } from "./client";
import { AuthResponse, User } from "@/types/auth";

export const authApi = {
  login: async (data: Record<string, any>) => {
    const response = await apiClient<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });

    const token = response.access_token || response.accessToken;
    if (!token) {
      throw new Error("Authentication token missing in response");
    }

    setAuthToken(token);

    return response;
  },

  register: async (data: Record<string, any>) => {
    const payload: Record<string, any> = {
      email: data.email,
      password: data.password,
      name: data.name,
    };

    const response = await apiClient<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const token = response.access_token || response.accessToken;
    if (!token) {
      throw new Error("Authentication token missing in response");
    }

    setAuthToken(token);

    return response;
  },

  getMe: async (): Promise<User> => {
    const payload = await apiClient<{
      sub: string;
      userId?: string;
      email: string;
      role: User["role"];
      companyId?: string | null;
    }>("/users/me");

    const derivedName = payload.email.split("@")[0] || "User";

    return {
      id: payload.userId || payload.sub,
      name: derivedName,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId ?? null,
    };
  },

  logout: () => {
    clearAuthToken();
  },
};
