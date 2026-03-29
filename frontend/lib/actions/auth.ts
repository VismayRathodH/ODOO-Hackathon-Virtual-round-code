"use server";

import { cookies } from "next/headers";
import { Role, User } from "@/types/auth";
import { redirect } from "next/navigation";

const AUTH_COOKIE_NAME = "auth_token";

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Mocking auth logic
  // In a real app, call NestJS backend
  if (email && password) {
    let role: Role = "EMPLOYEE";
    if (email.includes("admin")) role = "ADMIN";
    if (email.includes("manager")) role = "MANAGER";

    const user: User = {
      id: "1",
      name: email.split("@")[0],
      email,
      role,
      company: {
        id: "c1",
        name: "Acme Corp",
        currency: "USD",
      },
    };

    cookies().set(AUTH_COOKIE_NAME, JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    return { success: true, user };
  }

  return { success: false, error: "Invalid credentials" };
}

export async function logoutAction() {
  cookies().delete(AUTH_COOKIE_NAME);
  redirect("/login");
}
