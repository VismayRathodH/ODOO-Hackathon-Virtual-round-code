import { cookies } from "next/headers";
import { User, Role } from "@/types/auth";

const AUTH_COOKIE_NAME = "auth_token";

export async function getSession(): Promise<User | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME);

  if (!token) return null;

  // In a real app, verify JWT here
  try {
    // Mocking a payload decode
    // return JSON.parse(token.value);
    return null; // For now, return null to force login
  } catch {
    return null;
  }
}

export async function login(user: User) {
  const cookieStore = cookies();
  cookieStore.set(AUTH_COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function logout() {
  const cookieStore = cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getRole(): Promise<Role | null> {
  const user = await getSession();
  return user?.role || null;
}
