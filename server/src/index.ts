import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { registerSocketHandlers } from "./socket/handlers.js";

const app = express();
const httpServer = createServer(app);
const clientUrl = process.env.CLIENT_URL;
if (!clientUrl) {
  console.warn("⚠️  CLIENT_URL not set — CORS is open to all origins (development only)");
}

const io = new Server(httpServer, {
  cors: {
    origin: clientUrl || "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json({ limit: "10kb" }));

// Health check endpoint — minimal response to avoid leaking infrastructure details
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
