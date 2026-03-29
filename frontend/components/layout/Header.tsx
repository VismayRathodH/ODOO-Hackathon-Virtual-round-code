"use client";

import { Bell } from "lucide-react";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function Header({ title }: { title?: string }) {
  const { unreadCount, notifications, markAllAsRead } = useNotifications();

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b bg-background">
      <h1 className="text-xl font-semibold">{title || "ExpenseEase"}</h1>
      
      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead} 
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
                >
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-sm text-center text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "p-4 border-b last:border-0 hover:bg-muted/50 transition-colors",
                      !notif.read && "bg-muted/20"
                    )}
                  >
                    <p className="text-sm font-medium leading-none mb-1">
                      {notif.message}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
