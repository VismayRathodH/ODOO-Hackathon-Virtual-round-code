"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useState } from "react";

let socketInstance: Socket | null = null;
const updateSubscribers: ((s: Socket) => void)[] = [];

export const initiateSocket = (token: string) => {
  if (!socketInstance) {
    socketInstance = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
    });
    updateSubscribers.forEach((fn) => fn(socketInstance!));
  }
  return socketInstance;
};

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(socketInstance);

  useEffect(() => {
    if (!socket && socketInstance) {
      setSocket(socketInstance);
    }

    const handler = (s: Socket) => setSocket(s);
    updateSubscribers.push(handler);

    return () => {
      const idx = updateSubscribers.indexOf(handler);
      if (idx > -1) updateSubscribers.splice(idx, 1);
    };
  }, [socket]);

  return socket;
};
