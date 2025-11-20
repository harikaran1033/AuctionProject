// client/websocket.js
import { io } from "socket.io-client";

const SOCKET_URL = "https://auctionplay.onrender.com";

const socket = io(SOCKET_URL, {
  transports: ["polling", "websocket"], // try polling first (diagnostic), then upgrade
  autoConnect: true,
  withCredentials: false,
  path: "/socket.io",
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000,
});

socket.on("connect", () => console.log("✅ socket connected", socket.id));
socket.on("disconnect", (reason) => console.log("⚠️ socket disconnected:", reason));
socket.on("connect_error", (err) => {
  console.error("❌ socket connect_error:", err);
  // if err?.message exists, log full object for diagnosis
  console.error(err && err.message ? err : JSON.stringify(err));
});

export default socket;
