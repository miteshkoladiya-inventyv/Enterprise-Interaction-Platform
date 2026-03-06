import "./env.js";
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";

import connectDB from "./config/database.js";
import authRoutes from "./routes/auth.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import helperRoutes from "./routes/helper.routes.js";
import chatRouter from "./routes/chat.routes.js";
import fileRoutes from "./routes/file.routes.js";
import directChatRouter from "./routes/directChat.routes.js";
import callRoutes from "./routes/call.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import roleRoutes from "./routes/role.routes.js";
import whiteboardRoutes from "./routes/whiteboard.routes.js";
import documentRoutes from "./routes/document.routes.js";
import { verifyEmailConfig } from "./utils/emailService.js";
import { server, app } from "./socket/socketServer.js";
import { Message } from "./models/Message.js";
import Meeting from "./models/Meeting.js";

import { verifyToken } from "./middlewares/auth.middleware.js";
// Load environment variables

// const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
// app.use(cors({
//   origin: "*",        // allow all origins
//   credentials: true
// }));

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Connect to MongoDB
connectDB();

// Verify email configuration
verifyEmailConfig();

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      employees: "/api/employees",
      helper: "/api/helper",
      chat: "/api/chat",
      direct_chat: "/api/direct_chat",
      call: "/api/call",
      meetings: "/api/meetings",
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/helper", helperRoutes);
app.use("/api/chat", chatRouter);
app.use("/api/direct_chat", directChatRouter);
app.use("/api/call", callRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/whiteboards", whiteboardRoutes);
app.use("/api/documents", documentRoutes);
// Admin dashboard stats
app.get("/api/admin/stats", verifyToken, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [messagesToday, activeMeetings] = await Promise.all([
      Message.countDocuments({
        created_at: { $gte: todayStart },
        deleted_at: { $exists: false },
      }),
      Meeting.countDocuments({ status: "active" }),
    ]);

    res.json({ messagesToday, activeMeetings });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`HTTP: http://localhost:${PORT}`);
  console.log(`Socket.IO: ws://localhost:${PORT}`);
  console.log(`=================================`);
});

export default app;
