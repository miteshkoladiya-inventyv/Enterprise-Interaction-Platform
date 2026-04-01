import "./env.js";
import express from "express";
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
import departmentRoutes from "./routes/department.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import roleRoutes from "./routes/role.routes.js";
import documentRoutes from "./routes/document.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { verifyEmailConfig } from "./utils/emailService.js";
import { server, app, io } from "./socket/socketServer.js";
import { Message } from "./models/Message.js";
import Meeting from "./models/Meeting.js";
import { assertLiveKitCloudConfigured } from "./services/livekit.service.js";
import { runStaleTranscriptionCleanupJob } from "./controllers/meeting/recording.controller.js";
import { startMeetingMaintenanceScheduler } from "./jobs/meetingMaintenanceJob.js";
import { startTicketSlaScheduler } from "./jobs/ticketSlaJob.js";
import { initializeScheduledMessageJob } from "./services/scheduledMessage.service.js";

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

// Fail fast if LiveKit Cloud configuration is invalid.
assertLiveKitCloudConfigured();

// Connect to MongoDB
connectDB();

// Verify email configuration
verifyEmailConfig();

const transcriptionCleanupEnabled =
  String(process.env.ENABLE_STALE_TRANSCRIPTION_CLEANUP ?? "true").trim().toLowerCase() !== "false";
const transcriptionCleanupIntervalMs = Math.max(
  60_000,
  Number(process.env.STALE_TRANSCRIPTION_CLEANUP_INTERVAL_MS || 10 * 60 * 1000)
);
const transcriptionCleanupStaleMinutes = Math.max(
  5,
  Number(process.env.STALE_TRANSCRIPTION_CLEANUP_STALE_MINUTES || 30)
);

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
app.use("/api/departments", departmentRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
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

  if (transcriptionCleanupEnabled) {
    console.log(
      `Stale transcription cleanup enabled (interval: ${Math.round(
        transcriptionCleanupIntervalMs / 60000
      )}m, stale threshold: ${transcriptionCleanupStaleMinutes}m)`
    );

    const runCleanup = async () => {
      try {
        await runStaleTranscriptionCleanupJob({
          staleMinutes: transcriptionCleanupStaleMinutes,
        });
      } catch (error) {
        console.error("❌ [TRANSCRIPTION CLEANUP JOB] Failed:", error.message);
      }
    };

    setTimeout(() => {
      runCleanup();
    }, 15_000);

    setInterval(() => {
      runCleanup();
    }, transcriptionCleanupIntervalMs);
  } else {
    console.log("Stale transcription cleanup disabled (ENABLE_STALE_TRANSCRIPTION_CLEANUP=false)");
  }

  // ✅ Start meeting maintenance job (auto-cancel, auto-end meetings)
  try {
    startMeetingMaintenanceScheduler();
  } catch (error) {
    console.error("❌ Failed to start meeting maintenance scheduler:", error.message);
  }

  // ✅ Start ticket SLA check job (auto-breach detection, auto-escalation)
  try {
    startTicketSlaScheduler();
  } catch (error) {
    console.error("❌ Failed to start ticket SLA scheduler:", error.message);
  }

  // ✅ Start scheduled message job (send scheduled messages at their time)
  try {
    initializeScheduledMessageJob(io);
  } catch (error) {
    console.error("❌ Failed to start scheduled message job:", error.message);
  }

  console.log(`=================================`);
});

export default app;
