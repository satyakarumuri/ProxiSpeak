
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { Server } from "socket.io";
import authRoutes from "./routes/authRoutes.js";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const app = express();
const httpServer = createServer(app);

const allowedOrigin =
  process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use("/api/auth", authRoutes);

const io = new Server(httpServer, {
  cors: { origin: allowedOrigin }
});

// Authenticate every Socket.IO connection using the login JWT.
io.use((socket, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return next(new Error("Server authentication is not configured"));
    }

    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return next(new Error("Invalid authentication token"));
    }

    socket.data.userId = String(decoded.userId);
    next();
  } catch {
    next(new Error("Invalid or expired authentication token"));
  }
});

// Each room maps socket IDs to connected office users.
const officeRooms = new Map();

function leaveOffice(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const users = officeRooms.get(roomId);
  users?.delete(socket.id);

  socket.leave(roomId);
  socket.data.roomId = null;

  if (users?.size === 0) {
    officeRooms.delete(roomId);
  } else if (users) {
    io.to(roomId).emit("office:users", [...users.values()]);
  }

  socket.to(roomId).emit("office:user-left", {
    userId: socket.id
  });
}

io.on("connection", (socket) => {
  console.log(`Authenticated client connected: ${socket.id}`);

  socket.on("office:join", (payload, callback) => {
    const reply = typeof callback === "function" ? callback : () => {};
    const roomId = payload?.roomId;
    const name = payload?.user?.name;

    if (
      typeof roomId !== "string" ||
      roomId.trim().length < 1 ||
      roomId.length > 64 ||
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.length > 50
    ) {
      return reply({
        ok: false,
        message: "A valid room ID and user name are required"
      });
    }

    // Remove the socket from its previous office, if any.
    leaveOffice(socket);

    if (!officeRooms.has(roomId)) {
      officeRooms.set(roomId, new Map());
    }

    const users = officeRooms.get(roomId);

    const officeUser = {
      id: socket.id,
      name: name.trim(),
      position: { x: 0, y: 0, z: 2 },
      rotation: 0
    };

    users.set(socket.id, officeUser);
    socket.join(roomId);
    socket.data.roomId = roomId;

    reply({
      ok: true,
      users: [...users.values()]
    });

    socket.to(roomId).emit("office:user-joined", officeUser);
    io.to(roomId).emit("office:users", [...users.values()]);
  });

  socket.on("avatar:move", (payload) => {
    const roomId = socket.data.roomId;

    if (!roomId || !socket.rooms.has(roomId)) return;
    if (payload?.roomId !== roomId) return;

    const { x, y, z } = payload.position || {};
    const rotation = payload.rotation ?? 0;

    if (
      ![x, y, z, rotation].every(
        (value) =>
          typeof value === "number" && Number.isFinite(value)
      )
    ) {
      return;
    }

    if (
      x < -9 || x > 9 ||
      z < -7 || z > 7 ||
      Math.abs(y) > 0.1
    ) {
      return;
    }

    const users = officeRooms.get(roomId);
    const user = users?.get(socket.id);

    if (!user) return;

    user.position = { x, y, z };
    user.rotation = rotation;

    socket.to(roomId).emit("avatar:moved", {
      userId: socket.id,
      position: user.position,
      rotation
    });
  });

  // WebRTC Voice Signaling Relay (Sarthak's Audio Module)
  socket.on("voice:signal", (payload) => {
    const targetPeerId = payload?.to;
    const signalData = payload?.signal;

    if (!targetPeerId || !signalData) return;

    // Forward the signal to the specific target peer
    io.to(targetPeerId).emit("voice:signal", {
      from: socket.id,
      signal: signalData
    });
  });

  // Voice Speaking & Mute Status Broadcast
  socket.on("voice:status", (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    socket.to(roomId).emit("voice:status", {
      userId: socket.id,
      muted: !!payload?.muted,
      speaking: !!payload?.speaking
    });
  });

  socket.on("office:leave", () => leaveOffice(socket));

  socket.on("disconnect", () => {
    leaveOffice(socket);
    console.log(`Client disconnected: ${socket.id}`);
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    project: "ProxiSpeak",
    message: "Backend is running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected"
  });
});

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from backend/.env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from backend/.env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Atlas connected successfully");

    httpServer.listen(port, () => {
      console.log(
        `ProxiSpeak backend running at http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error("Failed to start ProxiSpeak:", error.message);
    process.exit(1);
  }
}

startServer();
