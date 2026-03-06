import Meeting from "../../models/Meeting.js";
import { scheduleRemindersForMeeting, clearRemindersForMeeting } from "../../services/meetingReminderService.js";
import { broadcastMeetingEvent } from "../../socket/socketServer.js";

function generateMeetingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return code;
}

async function ensureUniqueMeetingCode() {
  // Try a few times to generate a unique code
  for (let i = 0; i < 5; i += 1) {
    const code = generateMeetingCode();
    // eslint-disable-next-line no-await-in-loop
    const existing = await Meeting.findOne({ meeting_code: code }).lean();
    if (!existing) return code;
  }
  // Fallback to timestamp-based code
  return `MTG-${Date.now()}`;
}

export const createMeeting = async (req, res) => {
  try {
    const userId = req.userId;

    // Customers cannot create meetings
    if (req.user && req.user.user_type === "customer") {
      return res.status(403).json({ error: "Customers cannot schedule meetings" });
    }

    const {
      title,
      description,
      meeting_type,
      scheduled_at,
      duration_minutes,
      participants = [],
      recording_enabled,
      country_restriction,
      location,
      join_link,
      reminders = [],
      open_to_everyone = true,
    } = req.body;

    if (!title || !meeting_type) {
      return res.status(400).json({ error: "title and meeting_type are required" });
    }

    const meetingCode = await ensureUniqueMeetingCode();

    const meeting = new Meeting({
      meeting_code: meetingCode,
      title,
      description,
      host_id: userId,
      meeting_type,
      scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      duration_minutes,
      participants,
      recording_enabled,
      country_restriction: country_restriction || null,
      location,
      join_link,
      reminders,
      open_to_everyone,
      is_instant: req.body.is_instant || false,
    });

    await meeting.save();

    scheduleRemindersForMeeting(meeting);
    const populated = await Meeting.findById(meeting._id)
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();
    broadcastMeetingEvent("created", populated);

    return res.status(201).json({ data: populated });
  } catch (error) {
    // Handle unique index error gracefully
    if (error.code === 11000 && error.keyPattern?.meeting_code) {
      return res.status(409).json({ error: "Failed to generate unique meeting code. Please try again." });
    }
    console.error("[MEETING] createMeeting error:", error);
    return res.status(500).json({ error: "Failed to create meeting" });
  }
};

export const getMyMeetings = async (req, res) => {
  try {
    const userId = String(req.userId);
    const { from, to, status } = req.query;

    // Auto-cancel scheduled meetings if 5 minutes have passed after the scheduled time
    // and the host hasn't started them yet
    const now = new Date();
    const fiveMinutesMs = 5 * 60 * 1000;
    await Meeting.updateMany(
      {
        status: "scheduled",
        scheduled_at: { $ne: null },
        $expr: {
          $lt: [
            { $add: ["$scheduled_at", fiveMinutesMs] },
            now,
          ],
        },
      },
      { $set: { status: "cancelled" } }
    );

    // Auto-end active meetings that are past their scheduled time + duration
    await Meeting.updateMany(
      {
        status: "active",
        scheduled_at: { $ne: null },
        $expr: {
          $lt: [
            { $add: ["$scheduled_at", { $multiply: ["$duration_minutes", 60000] }] },
            now,
          ],
        },
      },
      { $set: { status: "ended", ended_at: now } }
    );

    const query = {
      $or: [
        { host_id: userId },
        { participants: userId },
      ],
    };

    if (status) {
      query.status = status;
    }

    if (from || to) {
      query.scheduled_at = {};
      if (from) query.scheduled_at.$gte = new Date(from);
      if (to) query.scheduled_at.$lte = new Date(to);
    }

    const meetings = await Meeting.find(query)
      .sort({ scheduled_at: 1 })
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();

    return res.json({ data: meetings });
  } catch (error) {
    console.error("[MEETING] getMyMeetings error:", error);
    return res.status(500).json({ error: "Failed to fetch meetings" });
  }
};

export const getMeetingByCode = async (req, res) => {
  try {
    const code = req.params.code || req.query.code;
    const normalizedCode = String(code || "").trim().toUpperCase();
    const userId = String(req.userId);

    console.log("[MEETING] getMeetingByCode called, code:", normalizedCode);

    if (!normalizedCode) {
      return res.status(400).json({ error: "Meeting code is required" });
    }

    const meeting = await Meeting.findOne({ meeting_code: normalizedCode });

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (meeting.status === "cancelled") {
      return res.status(410).json({ error: "This meeting has been cancelled" });
    }

    const isHost = String(meeting.host_id) === userId;
    const alreadyParticipant = meeting.participants.some(
      (p) => String(p) === userId
    );

    // For scheduled (not yet active) meetings, only existing participants and host can access
    if (meeting.status === "scheduled" && !isHost && !alreadyParticipant) {
      return res.status(403).json({
        error: "Only added participants can join this meeting.",
      });
    }

    // For active/instant meetings, auto-add when open to everyone
    if (!isHost && !alreadyParticipant && meeting.status !== "ended") {
      if (meeting.open_to_everyone !== false) {
        meeting.participants.push(userId);
        await meeting.save();
      } else if (meeting.is_instant) {
        // Instant meeting with open_to_everyone=false: return meeting data
        // without adding participant so the frontend can show the lobby
        const populated = await Meeting.findById(meeting._id)
          .populate("host_id", "first_name last_name email")
          .populate("participants", "first_name last_name email")
          .lean();
        return res.json({ data: { ...populated, _lobbyOnly: true } });
      } else {
        // Scheduled meeting — block non-participants entirely
        return res.status(403).json({
          error: "Only added participants can join this meeting.",
        });
      }
    }

    const populated = await Meeting.findById(meeting._id)
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();

    return res.json({ data: populated });
  } catch (error) {
    console.error("[MEETING] getMeetingByCode error:", error);
    return res.status(500).json({ error: "Failed to fetch meeting" });
  }
};

export const getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);

    const meeting = await Meeting.findById(id)
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const isParticipant =
      String(meeting.host_id?._id || meeting.host_id) === userId ||
      (Array.isArray(meeting.participants) &&
        meeting.participants.some((p) => String(p?._id || p) === userId));

    if (!isParticipant) {
      return res.status(403).json({ error: "You are not allowed to view this meeting" });
    }

    return res.json({ data: meeting });
  } catch (error) {
    console.error("[MEETING] getMeetingById error:", error);
    return res.status(500).json({ error: "Failed to fetch meeting" });
  }
};

export const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);

    // Customers cannot update meetings
    if (req.user && req.user.user_type === "customer") {
      return res.status(403).json({ error: "Customers cannot modify meetings" });
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (String(meeting.host_id) !== userId) {
      return res.status(403).json({ error: "Only the host can update this meeting" });
    }

    // Prevent starting a meeting before its scheduled time
    if (
      req.body.status === "active" &&
      meeting.status !== "active" &&
      meeting.scheduled_at
    ) {
      const now = new Date();
      const scheduledTime = new Date(meeting.scheduled_at);
      if (now < scheduledTime) {
        return res.status(400).json({
          error: `Cannot start meeting before its scheduled time (${scheduledTime.toLocaleString()})`,
        });
      }
    }

    const updatableFields = [
      "title",
      "description",
      "meeting_type",
      "scheduled_at",
      "duration_minutes",
      "participants",
      "recording_enabled",
      "country_restriction",
      "location",
      "join_link",
      "status",
      "reminders",
      "open_to_everyone",
    ];

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        // eslint-disable-next-line no-param-reassign
        meeting[field] =
          field === "scheduled_at" && req.body[field]
            ? new Date(req.body[field])
            : req.body[field];
      }
    });

    await meeting.save();

    if (meeting.status === "scheduled") {
      scheduleRemindersForMeeting(meeting);
    } else {
      clearRemindersForMeeting(meeting._id);
    }
    const updated = await Meeting.findById(meeting._id)
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();
    broadcastMeetingEvent("updated", updated);

    return res.json({ data: updated });
  } catch (error) {
    console.error("[MEETING] updateMeeting error:", error);
    return res.status(500).json({ error: "Failed to update meeting" });
  }
};

export const cancelMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);

    // Customers cannot cancel meetings
    if (req.user && req.user.user_type === "customer") {
      return res.status(403).json({ error: "Customers cannot cancel meetings" });
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (String(meeting.host_id) !== userId) {
      return res.status(403).json({ error: "Only the host can cancel this meeting" });
    }

    meeting.status = "cancelled";
    await meeting.save();

    clearRemindersForMeeting(meeting._id);
    const cancelled = await Meeting.findById(meeting._id)
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();
    broadcastMeetingEvent("cancelled", cancelled);

    return res.json({ data: cancelled });
  } catch (error) {
    console.error("[MEETING] cancelMeeting error:", error);
    return res.status(500).json({ error: "Failed to cancel meeting" });
  }
};

// Join a meeting by its ID – adds the current user as a participant
export const joinMeetingById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (meeting.status === "cancelled") {
      return res.status(410).json({ error: "This meeting has been cancelled" });
    }

    if (meeting.status === "ended") {
      return res.status(410).json({ error: "This meeting has already ended" });
    }

    // Check if already a participant or host
    const isHost = String(meeting.host_id) === userId;
    const alreadyParticipant = meeting.participants.some(
      (p) => String(p) === userId
    );

    // Non-host participants cannot join until the host has started the meeting
    if (!isHost && meeting.status !== "active") {
      return res.status(403).json({
        error: "The host has not started this meeting yet. Please wait for the host to start.",
      });
    }

    // For active meetings, auto-add if open_to_everyone; otherwise block non-participants
    if (!isHost && !alreadyParticipant) {
      if (meeting.open_to_everyone !== false) {
        meeting.participants.push(userId);
        await meeting.save();
      } else if (meeting.is_instant) {
        // Instant meeting with open_to_everyone=false: return meeting data
        // without adding participant so the frontend can show the lobby
        const populated = await Meeting.findById(meeting._id)
          .populate("host_id", "first_name last_name email")
          .populate("participants", "first_name last_name email")
          .lean();
        return res.json({ data: { ...populated, _lobbyOnly: true } });
      } else {
        // Scheduled meeting — block non-participants entirely
        return res.status(403).json({
          error: "Only added participants can join this meeting.",
        });
      }
    }

    const populated = await Meeting.findById(meeting._id)
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();
    broadcastMeetingEvent("updated", populated);

    return res.json({ data: populated });
  } catch (error) {
    console.error("[MEETING] joinMeetingById error:", error);
    return res.status(500).json({ error: "Failed to join meeting" });
  }
};

// Host admits a user from the lobby into the meeting
export const admitToMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);
    const { userId: guestUserId } = req.body;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    if (String(meeting.host_id) !== userId) {
      return res.status(403).json({ error: "Only the host can admit participants" });
    }
    if (meeting.status === "cancelled" || meeting.status === "ended") {
      return res.status(410).json({ error: "Meeting is not active" });
    }

    const guestId = String(guestUserId);
    const alreadyParticipant = meeting.participants.some((p) => String(p) === guestId);
    if (!alreadyParticipant) {
      meeting.participants.push(guestId);
      await meeting.save();
    }

    const populated = await Meeting.findById(meeting._id)
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();
    return res.json({ data: populated });
  } catch (error) {
    console.error("[MEETING] admitToMeeting error:", error);
    return res.status(500).json({ error: "Failed to admit participant" });
  }
};

// Delete a meeting permanently (only host, only ended/cancelled meetings)
export const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);

    // Customers cannot delete meetings
    if (req.user && req.user.user_type === "customer") {
      return res.status(403).json({ error: "Customers cannot delete meetings" });
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (String(meeting.host_id) !== userId) {
      return res.status(403).json({ error: "Only the host can delete this meeting" });
    }

    if (meeting.status !== "ended" && meeting.status !== "cancelled") {
      return res.status(400).json({ error: "Can only delete ended or cancelled meetings" });
    }

    clearRemindersForMeeting(meeting._id);
    await Meeting.findByIdAndDelete(id);
    broadcastMeetingEvent("deleted", { _id: id });

    return res.json({ message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("[MEETING] deleteMeeting error:", error);
    return res.status(500).json({ error: "Failed to delete meeting" });
  }
};

