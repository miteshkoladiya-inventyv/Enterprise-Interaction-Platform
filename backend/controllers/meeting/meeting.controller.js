import Meeting from "../../models/Meeting.js";
import { scheduleRemindersForMeeting, clearRemindersForMeeting } from "../../services/meetingReminderService.js";
import { broadcastMeetingEvent } from "../../socket/socketServer.js";
import { createLiveKitToken } from "../../services/livekit.service.js";
import { getLiveKitCloudDiagnostics } from "../../services/livekit.service.js";
import { validateLiveKitCloudCredentials } from "../../services/livekit.service.js";
import {
  applyMeetingCountryPolicies,
  buildMeetingCollaborationContext,
  convertScheduledLocalToUtc,
} from "../../utils/crossCountryCollaboration.js";
import { sendSuccess, sendError, sendCreated, sendForbidden, sendBadRequest, sendServerError } from "../../utils/responseFormatter.js";
import { checkMeetingAccess, verifyMeetingAccess } from "../../middlewares/auth.js";
import { validateMeetingTitle } from "../../utils/validation.js";

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

async function populateMeetingResponse(meetingId) {
  const meeting = await Meeting.findById(meetingId)
    .populate("host_id", "first_name last_name email country timezone user_type")
    .populate("participants", "first_name last_name email country timezone user_type")
    .lean();

  if (!meeting) return null;

  return {
    ...meeting,
    cross_country_context: buildMeetingCollaborationContext(meeting),
  };
}

export const createMeeting = async (req, res) => {
  try {
    const userId = req.userId;

    // Customers cannot create meetings
    if (req.user && req.user.user_type === "customer") {
      return sendForbidden(res, "Customers cannot schedule meetings");
    }

    const {
      title,
      description,
      meeting_type,
      scheduled_at,
      scheduled_date,
      scheduled_time,
      scheduled_timezone,
      duration_minutes,
      participants = [],
      recording_enabled,
      country_restriction,
      location,
      join_link,
      reminders = [],
      open_to_everyone = true,
      regional_compliance_ack = false,
    } = req.body;

    // ✅ Validate title
    if (!title || !meeting_type) {
      return sendBadRequest(res, "title and meeting_type are required");
    }

    let validatedTitle;
    try {
      validatedTitle = validateMeetingTitle(title);
    } catch (validationError) {
      return sendBadRequest(res, validationError.message);
    }

    const effectiveTimeZone = scheduled_timezone || req.user?.timezone || "UTC";
    const resolvedScheduledAt = scheduled_date && scheduled_time
      ? convertScheduledLocalToUtc(scheduled_date, scheduled_time, effectiveTimeZone)
      : scheduled_at
        ? new Date(scheduled_at)
        : null;

    const meetingCode = await ensureUniqueMeetingCode();
    const policyDecision = applyMeetingCountryPolicies({
      hostCountry: req.user?.country || null,
      requestedRecordingEnabled: recording_enabled,
      requestedOpenToEveryone: open_to_everyone,
      complianceApproved: regional_compliance_ack,
    });

    const meeting = new Meeting({
      meeting_code: meetingCode,
      title: validatedTitle,
      description,
      host_id: userId,
      meeting_type,
      scheduled_at: resolvedScheduledAt,
      scheduled_timezone: effectiveTimeZone,
      host_country: req.user?.country || null,
      host_timezone: req.user?.timezone || effectiveTimeZone,
      duration_minutes,
      participants,
      recording_enabled: policyDecision.recording_enabled,
      regional_compliance_ack: regional_compliance_ack === true,
      country_restriction: country_restriction || null,
      location,
      join_link,
      reminders,
      open_to_everyone:
        typeof policyDecision.open_to_everyone === "boolean"
          ? policyDecision.open_to_everyone
          : true,
      is_instant: req.body.is_instant || false,
    });

    await meeting.save();

    scheduleRemindersForMeeting(meeting);
    const populated = await populateMeetingResponse(meeting._id);
    broadcastMeetingEvent("created", populated);

    return sendCreated(res, {
      ...populated,
      _policy_warnings: policyDecision.policy_warnings,
      _policy_flags: policyDecision.policy_flags,
    }, "Meeting created successfully");
  } catch (error) {
    // Handle unique index error gracefully
    if (error.code === 11000 && error.keyPattern?.meeting_code) {
      return sendError(res, "Failed to generate unique meeting code. Please try again.", 409);
    }
    console.error("[MEETING] createMeeting error:", error.message);
    return sendServerError(res, error);
  }
};

export const getMeetingLiveKitToken = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const userId = String(req.userId);

    const meeting = await Meeting.findById(meetingId).lean();
    if (!meeting) {
      return sendError(res, "Meeting not found", 404);
    }

    // ✅ Use helper function instead of inline code
    const access = checkMeetingAccess(meeting, userId);
    if (!access.hasAccess) {
      return sendForbidden(res, "You are not allowed to join this meeting");
    }

    const roomName = `meeting-${String(meeting._id)}`;
    const identity = userId;
    const name = `${req.user?.first_name || ""} ${req.user?.last_name || ""}`.trim() || req.user?.email || `User ${userId}`;

    const tokenResponse = await createLiveKitToken({
      identity,
      name,
      roomName,
      metadata: {
        meetingId: String(meeting._id),
        userId,
        role: access.isHost ? "host" : "participant",
      },
    });

    return sendSuccess(res, {
      roomName,
      ...tokenResponse,
    });
  } catch (error) {
    console.error("[MEETING] getMeetingLiveKitToken error:", error.message);
    return sendServerError(res, error);
  }
};

export const getLiveKitDiagnostics = async (req, res) => {
  try {
    const diagnostics = getLiveKitCloudDiagnostics();

    const healthToken = await createLiveKitToken({
      identity: `diag-${Date.now()}`,
      name: "livekit-diagnostics",
      roomName: "diagnostics-room",
      metadata: { type: "diagnostics" },
    });

    await validateLiveKitCloudCredentials();

    return res.json({
      ok: true,
      diagnostics,
      tokenGeneration: {
        ok: Boolean(healthToken?.token),
      },
      credentialValidation: {
        ok: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "LiveKit diagnostics failed",
    });
  }
};

export const getMyMeetings = async (req, res) => {
  try {
    const userId = String(req.userId);
    const { from, to, status } = req.query;

    // ✅ FIX: Removed auto-cancel/auto-end logic from API endpoint
    // This is now handled by the background job (meetingMaintenanceJob.js)
    // to avoid duplicate updates and race conditions

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
      .populate("host_id", "first_name last_name email country timezone user_type")
      .populate("participants", "first_name last_name email country timezone user_type")
      .lean();

    return sendSuccess(res, meetings.map((meeting) => ({
      ...meeting,
      cross_country_context: buildMeetingCollaborationContext(meeting),
    })));
  } catch (error) {
    console.error("[MEETING] getMyMeetings error:", error.message);
    return sendServerError(res, error);
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
      const guestPolicy = applyMeetingCountryPolicies({
        hostCountry: meeting.host_country || req.user?.country || null,
        requestedRecordingEnabled: meeting.recording_enabled,
        requestedOpenToEveryone: meeting.open_to_everyone,
        complianceApproved: meeting.regional_compliance_ack === true,
      });

      if (guestPolicy.open_to_everyone !== false) {
        meeting.participants.push(userId);
        await meeting.save();
      } else if (meeting.is_instant) {
        // Instant meeting with open_to_everyone=false: return meeting data
        // without adding participant so the frontend can show the lobby
        const populated = await Meeting.findById(meeting._id)
          .populate("host_id", "first_name last_name email country timezone user_type")
          .populate("participants", "first_name last_name email country timezone user_type")
          .lean();
        return res.json({
          data: {
            ...populated,
            _lobbyOnly: true,
            cross_country_context: buildMeetingCollaborationContext(populated),
          },
        });
      } else {
        // Scheduled meeting — block non-participants entirely
        return res.status(403).json({
          error: "Only added participants can join this meeting.",
        });
      }
    }

    const populated = await populateMeetingResponse(meeting._id);

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

    const meeting = await populateMeetingResponse(id);

    if (!meeting) {
      return sendError(res, "Meeting not found", 404);
    }

    // ✅ Use helper function
    const access = checkMeetingAccess(meeting, userId);
    if (!access.hasAccess) {
      return sendForbidden(res, "You are not allowed to view this meeting");
    }

    return sendSuccess(res, meeting);
  } catch (error) {
    console.error("[MEETING] getMeetingById error:", error.message);
    return sendServerError(res, error);
  }
};

export const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);

    // Validate meeting ID exists
    if (!id || id === "undefined") {
      return sendBadRequest(res, "Meeting ID is required");
    }

    // Customers cannot update meetings
    if (req.user && req.user.user_type === "customer") {
      return sendForbidden(res, "Customers cannot modify meetings");
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return sendError(res, "Meeting not found", 404);
    }

    if (String(meeting.host_id) !== userId) {
      return sendForbidden(res, "Only the host can update this meeting");
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
      "duration_minutes",
      "participants",
      "recording_enabled",
      "regional_compliance_ack",
      "country_restriction",
      "location",
      "join_link",
      "status",
      "reminders",
      "open_to_everyone",
    ];

    if (req.body.scheduled_date && req.body.scheduled_time) {
      meeting.scheduled_at = convertScheduledLocalToUtc(
        req.body.scheduled_date,
        req.body.scheduled_time,
        req.body.scheduled_timezone || meeting.scheduled_timezone || req.user?.timezone || "UTC"
      );
      meeting.scheduled_timezone =
        req.body.scheduled_timezone || meeting.scheduled_timezone || req.user?.timezone || "UTC";
    } else if (Object.prototype.hasOwnProperty.call(req.body, "scheduled_at")) {
      meeting.scheduled_at = req.body.scheduled_at ? new Date(req.body.scheduled_at) : null;
      if (req.body.scheduled_timezone) {
        meeting.scheduled_timezone = req.body.scheduled_timezone;
      }
    }

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        // eslint-disable-next-line no-param-reassign
        meeting[field] = req.body[field];
      }
    });

    const hasPolicySensitiveUpdate =
      Object.prototype.hasOwnProperty.call(req.body, "recording_enabled") ||
      Object.prototype.hasOwnProperty.call(req.body, "open_to_everyone") ||
      Object.prototype.hasOwnProperty.call(req.body, "regional_compliance_ack");

    const policyDecision = hasPolicySensitiveUpdate
      ? applyMeetingCountryPolicies({
          hostCountry: meeting.host_country || req.user?.country || null,
          requestedRecordingEnabled: meeting.recording_enabled,
          requestedOpenToEveryone: meeting.open_to_everyone,
          complianceApproved: meeting.regional_compliance_ack === true,
        })
      : { policy_warnings: [], policy_flags: null };

    if (hasPolicySensitiveUpdate) {
      meeting.recording_enabled = !!policyDecision.recording_enabled;
      meeting.open_to_everyone =
        typeof policyDecision.open_to_everyone === "boolean"
          ? policyDecision.open_to_everyone
          : !!meeting.open_to_everyone;
    }

    await meeting.save();

    if (meeting.status === "scheduled") {
      scheduleRemindersForMeeting(meeting);
    } else {
      clearRemindersForMeeting(meeting._id);
    }
    const updated = await populateMeetingResponse(meeting._id);
    broadcastMeetingEvent("updated", updated);

    return res.json({
      data: updated,
      policy_warnings: policyDecision.policy_warnings,
      policy_flags: policyDecision.policy_flags,
    });
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
    const cancelled = await populateMeetingResponse(meeting._id);
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
      const guestPolicy = applyMeetingCountryPolicies({
        hostCountry: meeting.host_country || req.user?.country || null,
        requestedRecordingEnabled: meeting.recording_enabled,
        requestedOpenToEveryone: meeting.open_to_everyone,
        complianceApproved: meeting.regional_compliance_ack === true,
      });

      if (guestPolicy.open_to_everyone !== false) {
        meeting.participants.push(userId);
        await meeting.save();
      } else if (meeting.is_instant) {
        // Instant meeting with open_to_everyone=false: return meeting data
        // without adding participant so the frontend can show the lobby
        const populated = await Meeting.findById(meeting._id)
          .populate("host_id", "first_name last_name email country timezone user_type")
          .populate("participants", "first_name last_name email country timezone user_type")
          .lean();
        return res.json({
          data: {
            ...populated,
            _lobbyOnly: true,
            cross_country_context: buildMeetingCollaborationContext(populated),
          },
        });
      } else {
        // Scheduled meeting — block non-participants entirely
        return res.status(403).json({
          error: "Only added participants can join this meeting.",
        });
      }
    }

    const populated = await populateMeetingResponse(meeting._id);
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

    const populated = await populateMeetingResponse(meeting._id);
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

