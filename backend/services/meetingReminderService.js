import { getReceiverSocketId, io } from "../socket/socketServer.js";

// In-memory store: meetingId -> timeoutIds[]
const reminderTimeouts = new Map();

function clearRemindersForMeeting(meetingId) {
  const key = String(meetingId);
  const timeouts = reminderTimeouts.get(key);
  if (timeouts && Array.isArray(timeouts)) {
    timeouts.forEach((t) => clearTimeout(t));
  }
  reminderTimeouts.delete(key);
}

function scheduleRemindersForMeeting(meeting) {
  const meetingId = String(meeting._id);
  clearRemindersForMeeting(meetingId);

  if (!meeting.scheduled_at || meeting.status !== "scheduled") {
    return;
  }

  const scheduledTime = new Date(meeting.scheduled_at).getTime();
  if (Number.isNaN(scheduledTime)) return;

  const reminderDefs = Array.isArray(meeting.reminders)
    ? meeting.reminders
    : [];

  if (!reminderDefs.length) return;

  const now = Date.now();
  const timeouts = [];

  const allParticipantIds = new Set();
  if (meeting.host_id) allParticipantIds.add(String(meeting.host_id));
  if (Array.isArray(meeting.participants)) {
    meeting.participants.forEach((p) => {
      if (p) allParticipantIds.add(String(p._id || p));
    });
  }

  reminderDefs.forEach((rem) => {
    const minutesBefore = Number(rem.minutes_before);
    if (!Number.isFinite(minutesBefore) || minutesBefore < 0) return;

    const triggerAt = scheduledTime - minutesBefore * 60 * 1000;
    const delay = triggerAt - now;
    if (delay <= 0) return;

    const timeoutId = setTimeout(() => {
      const payload = {
        meetingId,
        title: meeting.title,
        description: meeting.description || "",
        scheduled_at: meeting.scheduled_at,
        duration_minutes: meeting.duration_minutes,
        location: meeting.location,
        join_link: meeting.join_link,
        minutes_before: minutesBefore,
      };

      allParticipantIds.forEach((userId) => {
        const socketId = getReceiverSocketId(userId);
        if (socketId) {
          io.to(socketId).emit("meeting-reminder", payload);
        }
      });
    }, delay);

    timeouts.push(timeoutId);
  });

  if (timeouts.length) {
    reminderTimeouts.set(meetingId, timeouts);
  }
}

export { scheduleRemindersForMeeting, clearRemindersForMeeting };

