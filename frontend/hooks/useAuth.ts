"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { hasAuthToken } from "@/lib/api/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["auth_me"],
    queryFn: authApi.getMe,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: typeof window !== "undefined" && hasAuthToken(),
  });

  // Redirect to dashboard if logged in and on auth pages
  useEffect(() => {
    if (user && (pathname === "/login" || pathname === "/register")) {
      router.push("/dashboard");
    }
  }, [user, pathname, router]);

  const logout = () => {
    authApi.logout();
    queryClient.setQueryData(["auth_me"], null);
    router.push("/login");
  };

  return {
    user,
    company: user?.company || null,
    role: user?.role || null,
    isLoading,
    isAuthenticated: !!user,
    isError,
    logout,
    refetch,
  };
}
