
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createServer } from "node:http";
import { Server } from "socket.io";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

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

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from backend/.env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Atlas connected successfully");

    httpServer.listen(port, () => {
      console.log(
        `ProxiSpeak backend running at http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB Atlas:");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
