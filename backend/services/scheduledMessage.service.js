import { ScheduledMessage } from "../models/ScheduledMessage.js";
import { Message } from "../models/Message.js";
import cron from "node-cron";

let io = null;
let isRunning = false;

/**
 * Initialize the scheduled message job
 * This should be called from the main server file
 */
export const initializeScheduledMessageJob = (socketInstance) => {
  io = socketInstance;

  // Run every minute to check for messages to send
  const job = cron.schedule("* * * * *", async () => {
    if (isRunning) return; // Prevent overlapping executions

    try {
      isRunning = true;
      await processScheduledMessages();
    } catch (error) {
      console.error("[SCHEDULED MESSAGE JOB] Error:", error.message);
    } finally {
      isRunning = false;
    }
  });

  console.log("[SCHEDULED MESSAGE JOB] Initialized - runs every minute");
  return job;
};

/**
 * Process all pending scheduled messages whose time has come
 */
const processScheduledMessages = async () => {
  try {
    const now = new Date();

    // Find all pending messages whose scheduled time has passed
    const messagesToSend = await ScheduledMessage.find({
      status: "pending",
      scheduled_send_time: { $lte: now },
    }).populate("sender_id", "first_name last_name email user_type");

    if (messagesToSend.length === 0) {
      return;
    }

    console.log(`[SCHEDULED MESSAGE JOB] Found ${messagesToSend.length} messages to send`);

    for (const scheduledMsg of messagesToSend) {
      try {
        // Create the actual message
        const message = new Message({
          channel_id: scheduledMsg.channel_id,
          sender_id: scheduledMsg.sender_id._id,
          content: scheduledMsg.content,
          message_type: scheduledMsg.message_type,
          parent_message_id: scheduledMsg.parent_message_id || null,
          rich_content: scheduledMsg.rich_content || null,
          file_url: scheduledMsg.file_url || null,
          file_name: scheduledMsg.file_name || null,
          file_type: scheduledMsg.file_type || null,
          file_size: scheduledMsg.file_size || null,
          cloudinary_public_id: scheduledMsg.cloudinary_public_id || null,
        });

        await message.save();

        // Populate the message for broadcasting
        const populatedMessage = await Message.findById(message._id)
          .populate("sender_id", "first_name last_name email user_type")
          .populate("parent_message_id");

        // Update scheduled message status
        scheduledMsg.status = "sent";
        scheduledMsg.sent_at = new Date();
        scheduledMsg.sent_message_id = message._id;
        scheduledMsg.retry_count = 0;
        await scheduledMsg.save();

        // Broadcast the message via socket
        if (io) {
          io.to(`channel:${scheduledMsg.channel_id}`).emit("new_message", populatedMessage);
          io.to(`channel:${scheduledMsg.channel_id}`).emit("message:scheduled-sent", {
            scheduled_message_id: scheduledMsg._id,
            message_id: message._id,
            channel_id: scheduledMsg.channel_id,
          });
        }

        console.log(
          `[SCHEDULED MESSAGE JOB] Successfully sent scheduled message ${scheduledMsg._id}`
        );
      } catch (error) {
        console.error(
          `[SCHEDULED MESSAGE JOB] Error sending message ${scheduledMsg._id}:`,
          error.message
        );

        // Update scheduled message with error
        scheduledMsg.retry_count = (scheduledMsg.retry_count || 0) + 1;

        if (scheduledMsg.retry_count >= (scheduledMsg.max_retries || 3)) {
          scheduledMsg.status = "failed";
          scheduledMsg.error_message = error.message;
        }

        await scheduledMsg.save();
      }
    }
  } catch (error) {
    console.error("[SCHEDULED MESSAGE JOB] Fatal error:", error.message);
  }
};

/**
 * Graceful shutdown - stop the cron job
 */
export const stopScheduledMessageJob = () => {
  console.log("[SCHEDULED MESSAGE JOB] Stopped");
};

/**
 * Get job statistics (for monitoring)
 */
export const getScheduledMessageStats = async () => {
  try {
    const pending = await ScheduledMessage.countDocuments({ status: "pending" });
    const sent = await ScheduledMessage.countDocuments({ status: "sent" });
    const failed = await ScheduledMessage.countDocuments({ status: "failed" });
    const cancelled = await ScheduledMessage.countDocuments({ status: "cancelled" });

    const nextScheduled = await ScheduledMessage.findOne({ status: "pending" })
      .sort({ scheduled_send_time: 1 })
      .select("scheduled_send_time");

    return {
      pending,
      sent,
      failed,
      cancelled,
      next_send_time: nextScheduled?.scheduled_send_time || null,
    };
  } catch (error) {
    console.error("[SCHEDULED MESSAGE JOB] Error getting stats:", error.message);
    return null;
  }
};
