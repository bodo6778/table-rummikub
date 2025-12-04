import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { registerSocketHandlers } from "./socket/handlers.js";
import redis from "./redis/client.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", redis: redis.status });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
