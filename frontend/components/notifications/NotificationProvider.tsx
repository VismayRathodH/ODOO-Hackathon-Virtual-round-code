"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSocket, initiateSocket } from "@/lib/socket";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/app/actions/auth";

interface Notification {
  id: string;
  message: string;
  read: boolean;
  type: "expense:submitted" | "approval:requested" | "expense:approved" | "expense:rejected" | string;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAllAsRead: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isSocketInit, setIsSocketInit] = useState(false);

  const socket = useSocket();

  useEffect(() => {
    async function init() {
      if (isAuthenticated && user?.id && !isSocketInit) {
        let token = await getToken();
        if (!token) {
          // Fallback to localStorage if the cookie is not found
          token = localStorage.getItem("auth_token") || null;
        }

        if (token) {
          initiateSocket(token);
          setIsSocketInit(true);
        }
      }
    }
    init();
  }, [isAuthenticated, user?.id, isSocketInit]);

  useEffect(() => {
    if (socket && user?.id) {
      socket.emit("join", { userId: user.id });

      const handleSubmitted = (data: any = {}) => {
        toast(`New expense submitted by ${data.name || "someone"}`);
        addNotification({
          message: `New expense submitted by ${data.name || "someone"}`,
          type: "expense:submitted",
        });
      };

      const handleApprovalRequested = () => {
        toast("You have a new expense to approve");
        addNotification({
          message: "You have a new expense to approve",
          type: "approval:requested",
        });
      };

      const handleApproved = () => {
        toast.success("Your expense was approved!");
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["approvals"] });
        addNotification({
          message: "Your expense was approved!",
          type: "expense:approved",
        });
      };

      const handleRejected = () => {
        toast.error("Your expense was rejected. Check comments.");
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["approvals"] });
        addNotification({
          message: "Your expense was rejected. Check comments.",
          type: "expense:rejected",
        });
      };

      socket.on("expense:submitted", handleSubmitted);
      socket.on("approval:requested", handleApprovalRequested);
      socket.on("expense:approved", handleApproved);
      socket.on("expense:rejected", handleRejected);

      return () => {
        socket.off("expense:submitted", handleSubmitted);
        socket.off("approval:requested", handleApprovalRequested);
        socket.off("expense:approved", handleApproved);
        socket.off("expense:rejected", handleRejected);
      };
    }
  }, [socket, user?.id, queryClient]);

  const addNotification = (notifData: Partial<Notification>) => {
    setNotifications((prev) =>
      [
        {
          id: notifData.id || Date.now().toString(),
          message: notifData.message || "",
          type: notifData.type || "unknown",
          read: false,
          createdAt: notifData.createdAt || new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 5)
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
