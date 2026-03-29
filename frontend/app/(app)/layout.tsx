"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <NotificationProvider>
        <div className="flex h-screen overflow-hidden bg-muted/20">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header is typically generic, but pages can also render their own if they need custom titles */}
            <Header title="ExpenseEase" />
            <main className="flex-1 overflow-y-auto p-6 md:p-8 animate-in">
              <div className="mx-auto max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </div>
      </NotificationProvider>
    </AuthGuard>
  );
}
