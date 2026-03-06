// hooks/useSocket.js
import { io } from "socket.io-client";
import { BACKEND_URL } from "@/config";

export const createSocketConnection = (userId) => {
  if (!userId) return null;

  const backendBase = BACKEND_URL.replace("/api", "");

  const socket = io(backendBase, {
    withCredentials: true,
    auth: {
      userId: userId,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log(`🔄 Reconnected after ${attemptNumber} attempts:`, socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Disconnected:", reason);
  });

  return socket;
};
