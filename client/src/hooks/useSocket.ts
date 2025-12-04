import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

// Create socket instance outside component to prevent StrictMode issues
let socketInstance: Socket | null = null;

function getSocket(): Socket {
  if (!socketInstance) {
    console.log("Initializing socket connection to:", SOCKET_URL);
    socketInstance = io(SOCKET_URL);

    socketInstance.on("connect", () => {
      console.log("Socket connected:", socketInstance?.id);
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });
  }
  return socketInstance;
}

export function useSocket() {
  const [socket] = useState<Socket>(() => getSocket());

  useEffect(() => {
    // Don't disconnect on unmount - keep connection alive
    return () => {
      // Cleanup is intentionally empty to prevent disconnects during StrictMode
    };
  }, [socket]);

  return socket;
}
