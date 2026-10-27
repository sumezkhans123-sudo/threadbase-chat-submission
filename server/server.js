
import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";
import { verifyToken } from "./middleware/auth.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// Demo users - log in as either to test chat in two windows.
const USERS = [
  { userId: 1, name: "Ada", email: "ada@threadbase.dev", password: "password" },
  { userId: 2, name: "Linus", email: "linus@threadbase.dev", password: "password" },
];

// POST /auth/login -> { accessToken, user }
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};
  const found = USERS.find(
    (u) => u.email === email && u.password === password
  );

  if (!found) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = jwt.sign(
    { userId: found.userId, name: found.name },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    accessToken,
    user: { userId: found.userId, name: found.name },
  });
});

// Existing protected HTTP route
app.get("/api/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Task 1: Create HTTP server and attach Socket.io
const PORT = process.env.PORT ?? 3001;
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

// Task 2: Authenticate socket connections using JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("No token provided"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = payload;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// Tasks 3: Join thread rooms and broadcast chat messages
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.data.user.name}`);

  socket.on("room:join", (roomId) => {
    if (typeof roomId !== "string" || !roomId.trim()) return;
    socket.join(roomId);
  });

  socket.on("chat:message", ({ roomId, text } = {}) => {
    if (
      typeof roomId !== "string" ||
      !roomId.trim() ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      return;
    }

    const message = {
      id: randomUUID(),
      text: text.trim(),
      user: socket.data.user.name,
      at: Date.now(),
    };

    io.to(roomId).emit("chat:message", message);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.data.user.name}`);
  });
});

// Task 4: Start the HTTP server, not app.listen()
httpServer.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
  console.log("  POST /auth/login");
  console.log("  Socket.io: ready");
});
