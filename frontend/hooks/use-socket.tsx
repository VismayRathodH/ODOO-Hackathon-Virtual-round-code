"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { initiateSocket, useSocket as useSharedSocket } from "@/lib/socket";
import { toast } from "sonner";

export function useSocket() {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socket = useSharedSocket();

  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem("auth_token");
      if (token) {
        initiateSocket(token);
      }
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onExpenseUpdate = (data: { id: string; status: string }) => {
      toast.info(`Expense #${data.id.slice(0, 8)} status updated to ${data.status}`, {
        id: `update-${data.id}`,
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("expense_update", onExpenseUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("expense_update", onExpenseUpdate);
    };
  }, [socket]);

  return { isConnected };
}
