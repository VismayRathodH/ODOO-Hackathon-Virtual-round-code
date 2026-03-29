"use server";

import { cookies } from "next/headers";

export async function getToken() {
  const cookieStore = cookies();
  return cookieStore.get("auth_token")?.value || cookieStore.get("token")?.value || null;
}
