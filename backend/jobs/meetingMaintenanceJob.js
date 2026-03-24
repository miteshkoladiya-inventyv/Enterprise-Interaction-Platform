/**
 * Background job to auto-cancel and auto-end meetings
 * Should run periodically (e.g., every 5 minutes)
 */
import Meeting from "../models/Meeting.js";
import { broadcastMeetingEvent } from "../socket/socketServer.js";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const STALE_JOB_INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes

/**
 * Auto-cancel meetings that are 5+ minutes past their scheduled time and haven't started
 * Auto-end active meetings that are past their scheduled time + duration
 */
export const runMeetingMaintenanceJob = async () => {
  try {
    console.log("[MEETING MAINTENANCE] Starting job...");
    const now = new Date();

    // ✅ FIX: Auto-cancel scheduled meetings (moved from getMyMeetings API endpoint)
    const cancelledResult = await Meeting.updateMany(
      {
        status: "scheduled",
        scheduled_at: { $ne: null },
        $expr: {
          $lt: [
            { $add: ["$scheduled_at", FIVE_MINUTES_MS] },
            now,
          ],
        },
      },
      { $set: { status: "cancelled" } }
    );

    if (cancelledResult.modifiedCount > 0) {
      console.log(`[MEETING MAINTENANCE] Auto-cancelled ${cancelledResult.modifiedCount} stale scheduled meetings`);

      // Broadcast cancellation events for affected meetings
      const cancelledMeetings = await Meeting.find({
        status: "cancelled",
        scheduled_at: {
          $lt: now,
          $gte: new Date(now.getTime() - 10 * 60 * 1000), // Last 10 minutes
        },
      }).lean();

      cancelledMeetings.forEach((meeting) => {
        broadcastMeetingEvent("cancelled", meeting);
      });
    }

    // ✅ FIX: Auto-end active meetings past their scheduled time + duration
    const endedResult = await Meeting.updateMany(
      {
        status: "active",
        scheduled_at: { $ne: null },
        duration_minutes: { $gt: 0 },
        $expr: {
          $lt: [
            { $add: ["$scheduled_at", { $multiply: ["$duration_minutes", 60000] }] },
            now,
          ],
        },
      },
      { $set: { status: "ended", ended_at: now } }
    );

    if (endedResult.modifiedCount > 0) {
      console.log(`[MEETING MAINTENANCE] Auto-ended ${endedResult.modifiedCount} meetings past their duration`);

      // Broadcast end events for affected meetings
      const endedMeetings = await Meeting.find({
        status: "ended",
        ended_at: {
          $gte: new Date(now.getTime() - 10 * 60 * 1000), // Last 10 minutes
        },
      }).lean();

      endedMeetings.forEach((meeting) => {
        broadcastMeetingEvent("ended", meeting);
      });
    }

    console.log("[MEETING MAINTENANCE] Job completed successfully");
  } catch (error) {
    console.error("[MEETING MAINTENANCE] Error:", error.message);
  }
};

/**
 * Start periodic meeting maintenance job
 * Call this from server initialization
 */
export const startMeetingMaintenanceScheduler = () => {
  console.log("[MEETING MAINTENANCE] Scheduler started (interval: 5 minutes)");

  // Run immediately on startup
  runMeetingMaintenanceJob();

  // Then run periodically
  const intervalId = setInterval(runMeetingMaintenanceJob, STALE_JOB_INTERVAL_MS);

  return intervalId;
};
