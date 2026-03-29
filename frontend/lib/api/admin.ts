import { apiClient } from "./client";
import { Role } from "@/types/auth";

type BackendUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  companyId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId?: string | null;
  managerId?: string;
  managerName?: string;
  status: "ACTIVE" | "INACTIVE" | "INVITED";
}

const fallbackName = (user: Pick<BackendUser, "name" | "email">) => {
  const trimmed = user.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : user.email.split("@")[0] || "User";
};

const mapUsers = (users: BackendUser[]): AdminUser[] => {
  const byId = new Map(users.map((user) => [user.id, user]));

  return users.map((user) => {
    const manager = user.managerId ? byId.get(user.managerId) : undefined;

    return {
      id: user.id,
      name: fallbackName(user),
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      managerId: user.managerId ?? undefined,
      managerName: manager ? fallbackName(manager) : undefined,
      status: "ACTIVE",
    };
  });
};

const generateTempPassword = () => {
  return `Temp#${Math.random().toString(36).slice(2, 10)}9`;
};

export const adminApi = {
  getUsers: async () => {
    const users = await apiClient<BackendUser[]>("/users");
    return mapUsers(users);
  },

  createUser: async (data: {
    name: string;
    email: string;
    role: Role;
    managerId?: string;
    password?: string;
  }) => {
    const created = await apiClient<BackendUser>("/users", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        role: data.role,
        managerId: data.managerId,
        password: data.password || generateTempPassword(),
      }),
    });

    const users = await apiClient<BackendUser[]>("/users");
    const mapped = mapUsers(users);
    return mapped.find((user) => user.id === created.id) || mapUsers([created])[0];
  },

  updateUser: async (id: string, data: { role?: Role; managerId?: string }) => {
    const updated = await apiClient<BackendUser>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    const users = await apiClient<BackendUser[]>("/users");
    const mapped = mapUsers(users);
    return mapped.find((user) => user.id === updated.id) || mapUsers([updated])[0];
  },
};
