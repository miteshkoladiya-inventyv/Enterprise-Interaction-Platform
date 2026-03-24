import Meeting from "../../models/Meeting.js";
import MeetingRecording from "../../models/MeetingRecording.js";
import { cloudinary } from "../../config/cloudinary.js";
import OpenAI from "openai";
import { AssemblyAI } from "assemblyai";
import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { evaluateCountryFeatureAccess } from "../../utils/crossCountryCollaboration.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAssemblyAIClient() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("AssemblyAI API key is not configured. Set ASSEMBLYAI_API_KEY in backend/.env and restart the backend.");
  }

  return new AssemblyAI({ apiKey });
}

const ASSEMBLYAI_SPEECH_MODELS = ["universal-3-pro", "universal-2"];
const TRANSCRIPTION_MODES = ["assemblyai", "local"];
const LOCAL_WHISPER_SCRIPT_PATH = path.resolve(__dirname, "../../scripts/whisper_transcribe.py");
const TRANSCRIPTION_TIMEOUT_MS = Number(process.env.TRANSCRIPTION_TIMEOUT_MS || 8 * 60 * 1000);

function normalizeTranscriptionMode(mode) {
  const normalized = String(mode || "assemblyai").trim().toLowerCase();
  if (!TRANSCRIPTION_MODES.includes(normalized)) {
    throw new Error(`Unsupported transcription mode: ${mode}`);
  }
  return normalized;
}

function withTimeout(promise, timeoutMs, label = "Operation") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`));
      }, timeoutMs);
    }),
  ]);
}

async function downloadRecordingToTempFile(recording) {
  const url = new URL(recording.cloudinary_url);
  const extension = path.extname(url.pathname) || ".webm";
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "meeting-recording-"));
  const tempFilePath = path.join(tempDir, `recording${extension}`);

  const response = await fetch(recording.cloudinary_url);
  if (!response.ok) {
    throw new Error(`Failed to download recording from Cloudinary (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(tempFilePath, buffer);

  return { tempDir, tempFilePath };
}

async function transcribeWithAssemblyAI(recording) {
  const assemblyai = getAssemblyAIClient();
  console.log(`🔄 [TRANSCRIPTION] Sending to AssemblyAI (speaker diarization enabled)...`);

  const result = await assemblyai.transcripts.transcribe({
    audio: recording.cloudinary_url,
    speech_models: ASSEMBLYAI_SPEECH_MODELS,
    speaker_labels: true,
  });

  if (result.status === "error") {
    throw new Error(result.error || "AssemblyAI transcription failed");
  }

  return {
    provider: "AssemblyAI",
    text: result.text || "",
    segments: (result.utterances || []).map((u) => ({
      start: u.start / 1000,
      end: u.end / 1000,
      text: u.text?.trim() || "",
      speaker: u.speaker || null,
    })),
  };
}

async function transcribeWithLocalWhisper(recording) {
  const pythonPath = process.env.WHISPER_PYTHON_PATH?.trim();
  const whisperModel = process.env.WHISPER_MODEL?.trim() || "small";

  if (!pythonPath) {
    throw new Error("Local Whisper is not configured. Set WHISPER_PYTHON_PATH in backend/.env and restart the backend.");
  }

  await fs.access(pythonPath);
  await fs.access(LOCAL_WHISPER_SCRIPT_PATH);

  console.log(`🔄 [TRANSCRIPTION] Downloading recording for local Whisper...`);
  const { tempDir, tempFilePath } = await downloadRecordingToTempFile(recording);

  try {
    console.log(`🖥️  [TRANSCRIPTION] Running local Whisper (${whisperModel})...`);

    const { stdout, stderr } = await execFileAsync(
      pythonPath,
      [LOCAL_WHISPER_SCRIPT_PATH, tempFilePath, "--model", whisperModel],
      { maxBuffer: 20 * 1024 * 1024 }
    );

    if (stderr?.trim()) {
      console.log(`🖥️  [TRANSCRIPTION] Local Whisper logs:\n${stderr.trim()}`);
    }

    const result = JSON.parse(stdout);
    if (result.error) {
      throw new Error(result.error);
    }

    return {
      provider: "Local Whisper",
      text: result.text || "",
      segments: (result.segments || []).map((segment) => ({
        start: Number(segment.start || 0),
        end: Number(segment.end || 0),
        text: segment.text?.trim() || "",
        speaker: null,
      })),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// Groq client for LLM tasks (notes generation, chat) — uses OpenAI-compatible API
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Upload a single meeting recording (video/audio/screen) to Cloudinary and save metadata.
 * Only meeting host can upload. Body (multipart): participant_id, participant_name, type (video|audio|screen), started_at, ended_at.
 */
export const uploadRecording = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const userId = String(req.userId);

    console.log(`\n📹 [RECORDING UPLOAD] Started for meeting ${meetingId} by user ${userId}`);

    const meeting = await Meeting.findById(meetingId).lean();
    if (!meeting) {
      console.log(`❌ [RECORDING UPLOAD] Meeting ${meetingId} not found`);
      return res.status(404).json({ error: "Meeting not found" });
    }
    if (String(meeting.host_id) !== userId) {
      console.log(`❌ [RECORDING UPLOAD] User ${userId} is not the host of meeting ${meetingId}`);
      return res.status(403).json({ error: "Only the host can upload meeting recordings" });
    }

    const recordingPolicy = evaluateCountryFeatureAccess(
      meeting.host_country,
      "meeting_recording",
      { complianceApproved: meeting.regional_compliance_ack === true }
    );
    const recordingAllowed = meeting.recording_enabled === true && recordingPolicy.allowed;
    if (!recordingAllowed) {
      return res.status(403).json({
        error:
          recordingPolicy.reason ||
          "Meeting recording is disabled by policy for this host country.",
      });
    }

    if (!req.file || !req.file.buffer) {
      console.log(`❌ [RECORDING UPLOAD] No file provided`);
      return res.status(400).json({ error: "No recording file provided" });
    }

    console.log(`📁 [RECORDING UPLOAD] File received: ${req.file.originalname || 'recording'} (${(req.file.buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    const {
      participant_id,
      participant_name,
      type,
      started_at,
      ended_at,
    } = req.body;

    if (!participant_id || !type || !started_at || !ended_at) {
      return res.status(400).json({
        error: "participant_id, type, started_at, ended_at are required",
      });
    }
    const validTypes = ["video", "audio", "screen"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "type must be video, audio, or screen" });
    }

    const started = new Date(started_at);
    const ended = new Date(ended_at);
    const durationSeconds = Math.max(0, Math.round((ended - started) / 1000));

    const publicId = `meeting-recordings/${meetingId}/${type}-${participant_id}-${Date.now()}`;

    console.log(`☁️  [RECORDING UPLOAD] Uploading to Cloudinary... (type: ${type}, participant: ${participant_name || participant_id}, duration: ${durationSeconds}s)`);

    // Use "video" resource type so Cloudinary can serve it as a playable video
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "meeting-recordings",
          public_id: publicId,
          format: "webm",
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const recording = new MeetingRecording({
      meeting_id: meetingId,
      participant_id: participant_id,
      participant_name: participant_name || null,
      type,
      cloudinary_url: result.secure_url,
      cloudinary_public_id: result.public_id,
      started_at: started,
      ended_at: ended,
      duration_seconds: durationSeconds,
      transcription_status: "not_started",
      transcription_error: null,
    });
    await recording.save();

    console.log(`✅ [RECORDING UPLOAD] Saved to DB (id: ${recording._id})`);
    console.log(`🔗 [RECORDING UPLOAD] Cloudinary URL: ${result.secure_url}`);
    console.log(`🎙️  [RECORDING UPLOAD] Transcription ready to start manually (Local Whisper or AssemblyAI)`);

    return res.status(201).json({
      data: {
        _id: recording._id,
        meeting_id: recording.meeting_id,
        participant_id: recording.participant_id,
        participant_name: recording.participant_name,
        type: recording.type,
        cloudinary_url: recording.cloudinary_url,
        started_at: recording.started_at,
        ended_at: recording.ended_at,
        duration_seconds: recording.duration_seconds,
        transcription_status: recording.transcription_status,
      },
    });
  } catch (error) {
    console.error("❌ [RECORDING UPLOAD] Error:", error.message);
    return res.status(500).json({
      error: error.message || "Failed to upload recording",
    });
  }
};

/**
 * List all recordings for a meeting. Only participants (including host) can list.
 */
export const listRecordings = async (req, res) => {
  try {
    const { id: meetingId } = req.params;
    const userId = String(req.userId);

    const meeting = await Meeting.findById(meetingId).lean();
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const isParticipant =
      String(meeting.host_id) === userId ||
      (Array.isArray(meeting.participants) &&
        meeting.participants.some((p) => String(p) === userId));

    if (!isParticipant) {
      return res.status(403).json({ error: "You are not allowed to view these recordings" });
    }

    const recordings = await MeetingRecording.find({ meeting_id: meetingId })
      .sort({ started_at: 1 })
      .lean();

    return res.json({ data: recordings });
  } catch (error) {
    console.error("[MEETING_RECORDING] list error:", error);
    return res.status(500).json({ error: "Failed to fetch recordings" });
  }
};

/**
 * Background helper: transcribe a recording using the selected provider, then update the DB record.
 */
async function transcribeRecording(recordingId, mode = "assemblyai") {
  const transcriptionMode = normalizeTranscriptionMode(mode);
  const providerLabel = transcriptionMode === "local" ? "Local Whisper" : "AssemblyAI";

  console.log(`\n🎙️  [TRANSCRIPTION] Starting ${providerLabel} transcription for recording ${recordingId}`);

  const recording = await MeetingRecording.findById(recordingId);
  if (!recording) {
    console.log(`❌ [TRANSCRIPTION] Recording ${recordingId} not found in DB, aborting`);
    return;
  }

  if (recording.transcription_status === "cancelled") {
    console.log(`⏹️  [TRANSCRIPTION] Recording ${recordingId} is cancelled, skipping transcription`);
    return;
  }

  try {
    recording.transcription_status = "processing";
    recording.transcript = null;
    recording.transcript_segments = [];
    recording.transcription_error = null;
    await recording.save();
    console.log(`⏳ [TRANSCRIPTION] Status set to 'processing'`);

    const startTime = Date.now();

    const result = await withTimeout(
      transcriptionMode === "local"
        ? transcribeWithLocalWhisper(recording)
        : transcribeWithAssemblyAI(recording),
      TRANSCRIPTION_TIMEOUT_MS,
      `${providerLabel} transcription`
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fullText = (result.text || "").trim();
    const segments = (result.segments || []).filter((segment) =>
      (segment?.text || "").trim().length > 0
    );
    const normalizedText = fullText || segments.map((segment) => segment.text.trim()).join(" ").trim();

    console.log(`⏱️  [TRANSCRIPTION] ${result.provider} completed in ${elapsed}s`);
    console.log(`📝 [TRANSCRIPTION] Transcript length: ${normalizedText.length} chars, ${segments.length} utterances`);
    if (normalizedText.length > 0) {
      console.log(`📝 [TRANSCRIPTION] Preview: "${normalizedText.substring(0, 150)}${normalizedText.length > 150 ? "..." : ""}"`);
    } else {
      throw new Error("Transcript is empty (silent audio or unrecognizable speech)");
    }

    const latestBeforeSave = await MeetingRecording.findById(recordingId);
    if (!latestBeforeSave) {
      console.log(`⚠️  [TRANSCRIPTION] Recording ${recordingId} disappeared before save`);
      return;
    }

    if (latestBeforeSave.transcription_status === "cancelled") {
      console.log(`⏹️  [TRANSCRIPTION] Recording ${recordingId} was cancelled while processing; skipping completion update`);
      return;
    }

    latestBeforeSave.transcript = normalizedText;
    latestBeforeSave.transcript_segments = segments;
    latestBeforeSave.transcription_status = "completed";
    latestBeforeSave.transcription_error = null;
    await latestBeforeSave.save();

    console.log(`✅ [TRANSCRIPTION] ${result.provider} transcript completed and saved for recording ${recordingId}`);
  } catch (error) {
    console.error(`❌ [TRANSCRIPTION] Failed for recording ${recordingId}:`, error.message);
    if (/auth|token|unauthorized|401/i.test(error.message || "")) {
      console.error("❌ [TRANSCRIPTION] AssemblyAI authentication failed. Verify ASSEMBLYAI_API_KEY and restart the backend process.");
    }
    const latestOnError = await MeetingRecording.findById(recordingId);
    if (!latestOnError) {
      console.log(`⚠️  [TRANSCRIPTION] Recording ${recordingId} not found while saving error state`);
      return;
    }

    if (latestOnError.transcription_status === "cancelled") {
      console.log(`⏹️  [TRANSCRIPTION] Recording ${recordingId} cancelled during processing; preserving cancelled state`);
      return;
    }

    latestOnError.transcription_status = "failed";
    latestOnError.transcription_error = (error.message || "Transcription failed").slice(0, 500);
    await latestOnError.save();
    console.log(`⚠️  [TRANSCRIPTION] Status set to 'failed'`);
  }
}
/**
 * POST /api/meetings/:id/recordings/:recordingId/generate-notes
 * Generate meeting notes from the transcript of a specific recording using GPT-4o.
 */
export const generateMeetingNotes = async (req, res) => {
  try {
    const { id: meetingId, recordingId } = req.params;
    const userId = String(req.userId);

    console.log(`\n📋 [MEETING NOTES] Generating notes for recording ${recordingId} (meeting: ${meetingId})`);

    const meeting = await Meeting.findById(meetingId).lean();
    if (!meeting) {
      console.log(`❌ [MEETING NOTES] Meeting ${meetingId} not found`);
      return res.status(404).json({ error: "Meeting not found" });
    }

    const isParticipant =
      String(meeting.host_id) === userId ||
      (Array.isArray(meeting.participants) &&
        meeting.participants.some((p) => String(p) === userId));

    if (!isParticipant) {
      return res.status(403).json({ error: "You are not allowed to access this recording" });
    }

    const recording = await MeetingRecording.findOne({
      _id: recordingId,
      meeting_id: meetingId,
    });

    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    if (recording.transcription_status !== "completed" || !recording.transcript) {
      console.log(`⚠️  [MEETING NOTES] Transcript not ready (status: ${recording.transcription_status})`);
      return res.status(400).json({
        error: "Transcript is not available yet. Please wait for transcription to complete.",
        transcription_status: recording.transcription_status,
      });
    }

    // If notes already exist, return them unless ?regenerate=true
    if (recording.meeting_notes && req.query.regenerate !== "true") {
      console.log(`📋 [MEETING NOTES] Returning cached notes`);
      return res.json({
        data: {
          meeting_notes: recording.meeting_notes,
          transcript: recording.transcript,
          transcript_segments: recording.transcript_segments,
        },
      });
    }

    console.log(`🔄 [MEETING NOTES] Sending transcript to Groq ${GROQ_MODEL} (${recording.transcript.length} chars)...`);
    const notesStartTime = Date.now();

    // Generate meeting notes using Groq
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an expert meeting assistant. Given a meeting transcript, generate comprehensive and well-structured meeting notes. Your notes should include:

1. **Meeting Summary** — A brief 2-3 sentence overview of the meeting
2. **Key Discussion Points** — Bullet points of the main topics discussed
3. **Decisions Made** — Any decisions or agreements reached
4. **Action Items** — Specific tasks assigned with owners if mentioned
5. **Important Details** — Any deadlines, numbers, or critical information mentioned
6. **Follow-ups** — Any items that need follow-up or further discussion

Use markdown formatting. Be concise but thorough. If the transcript is unclear or contains mostly silence/noise, note that accordingly.`,
        },
        {
          role: "user",
          content: `Meeting Title: ${meeting.title || "Untitled Meeting"}
Meeting Date: ${meeting.scheduled_at ? new Date(meeting.scheduled_at).toLocaleString() : "N/A"}

Transcript:
${recording.transcript}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const meetingNotes = completion.choices[0]?.message?.content?.trim() || "";
    const notesElapsed = ((Date.now() - notesStartTime) / 1000).toFixed(1);

    console.log(`⏱️  [MEETING NOTES] Groq responded in ${notesElapsed}s`);
    console.log(`📋 [MEETING NOTES] Generated ${meetingNotes.length} chars of notes`);
    console.log(`📋 [MEETING NOTES] Preview: "${meetingNotes.substring(0, 150)}${meetingNotes.length > 150 ? '...' : ''}"`);

    recording.meeting_notes = meetingNotes;
    await recording.save();

    console.log(`✅ [MEETING NOTES] Saved to DB for recording ${recordingId}`);

    return res.json({
      data: {
        meeting_notes: meetingNotes,
        transcript: recording.transcript,
        transcript_segments: recording.transcript_segments,
      },
    });
  } catch (error) {
    console.error("❌ [MEETING NOTES] Error:", error.message);
    if (error.status) console.error("❌ [MEETING NOTES] API Status:", error.status);
    if (error.error) console.error("❌ [MEETING NOTES] API Error:", JSON.stringify(error.error));
    return res.status(500).json({ error: error.message || "Failed to generate meeting notes" });
  }
};

/**
 * POST /api/meetings/:id/recordings/:recordingId/retry-transcription
 * Retry/restart transcription for a recording via the selected transcription provider.
 */
export const retryTranscription = async (req, res) => {
  try {
    const { id: meetingId, recordingId } = req.params;
    const userId = String(req.userId);
    const transcriptionMode = normalizeTranscriptionMode(req.query.mode || req.body?.mode || "assemblyai");
    const forceRetry =
      String(req.query.force || req.body?.force || "false").trim().toLowerCase() === "true";
    const providerLabel = transcriptionMode === "local" ? "Local Whisper" : "AssemblyAI";

    console.log(`\n🔄 [RETRY TRANSCRIPTION] Requested for recording ${recordingId} (meeting: ${meetingId}, mode: ${transcriptionMode})`);

    const meeting = await Meeting.findById(meetingId).lean();
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (String(meeting.host_id) !== userId) {
      return res.status(403).json({ error: "Only the host can retry transcription" });
    }

    const recording = await MeetingRecording.findOne({
      _id: recordingId,
      meeting_id: meetingId,
    });

    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    if (recording.transcription_status === "processing" && !forceRetry) {
      console.log(`⚠️  [RETRY TRANSCRIPTION] Already processing, skipping`);
      return res.status(400).json({ error: "Transcription is already in progress" });
    }

    recording.transcription_status = "pending";
    recording.transcription_error = null;
    await recording.save();

    console.log(`🎙️  [RETRY TRANSCRIPTION] Kicking off ${providerLabel} transcription...`);
    transcribeRecording(recording._id, transcriptionMode).catch((err) => {
      console.error(`❌ [RETRY TRANSCRIPTION] error:`, err.message);
    });

    return res.json({ message: `${providerLabel} transcription started`, transcription_status: "processing", mode: transcriptionMode });
  } catch (error) {
    console.error("❌ [RETRY TRANSCRIPTION] Error:", error.message);
    return res.status(500).json({ error: "Failed to retry transcription" });
  }
};

/**
 * POST /api/meetings/:id/recordings/:recordingId/stop-transcription
 * Stop/cancel an in-progress transcription job.
 */
export const stopTranscription = async (req, res) => {
  try {
    const { id: meetingId, recordingId } = req.params;
    const userId = String(req.userId);

    const meeting = await Meeting.findById(meetingId).lean();
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const isHost = String(meeting.host_id) === userId;
    const isAdminUser = req.user?.user_type === "admin";
    if (!isHost && !isAdminUser) {
      return res.status(403).json({ error: "Only the host or admin can stop transcription" });
    }

    const recording = await MeetingRecording.findOne({
      _id: recordingId,
      meeting_id: meetingId,
    });

    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    if (!["pending", "processing"].includes(recording.transcription_status)) {
      return res.json({
        message: "Transcription is not running",
        transcription_status: recording.transcription_status,
      });
    }

    recording.transcription_status = "cancelled";
    recording.transcription_error = "Stopped by user";
    await recording.save();

    return res.json({
      message: "Transcription stopped",
      transcription_status: "cancelled",
    });
  } catch (error) {
    console.error("❌ [STOP TRANSCRIPTION] Error:", error.message);
    return res.status(500).json({ error: "Failed to stop transcription" });
  }
};

async function executeStaleTranscriptionCleanup({ staleMinutes = 30, dryRun = false } = {}) {
  const normalizedStaleMinutes = Number.isFinite(Number(staleMinutes))
    ? Math.min(1440, Math.max(5, Math.floor(Number(staleMinutes))))
    : 30;

  const cutoff = new Date(Date.now() - normalizedStaleMinutes * 60 * 1000);
  const filter = {
    transcription_status: { $in: ["pending", "processing"] },
    updatedAt: { $lt: cutoff },
  };

  const staleRecords = await MeetingRecording.find(filter)
    .select("_id meeting_id transcription_status updatedAt participant_name")
    .sort({ updatedAt: 1 })
    .lean();

  if (dryRun) {
    return {
      dryRun: true,
      staleMinutes: normalizedStaleMinutes,
      cutoff,
      count: staleRecords.length,
      records: staleRecords,
    };
  }

  if (staleRecords.length === 0) {
    return {
      dryRun: false,
      staleMinutes: normalizedStaleMinutes,
      cutoff,
      matched: 0,
      modified: 0,
      message: "No stale transcription jobs found.",
      records: [],
    };
  }

  const staleIds = staleRecords.map((r) => r._id);
  const result = await MeetingRecording.updateMany(
    { _id: { $in: staleIds } },
    {
      $set: {
        transcription_status: "failed",
        transcription_error: `Marked failed by cleanup after ${normalizedStaleMinutes} minutes without completion.`,
      },
    }
  );

  return {
    dryRun: false,
    staleMinutes: normalizedStaleMinutes,
    cutoff,
    matched: result.matchedCount,
    modified: result.modifiedCount,
    records: staleRecords,
  };
}

export const runStaleTranscriptionCleanupJob = async (options = {}) => {
  const staleMinutes = options?.staleMinutes ?? 30;
  const result = await executeStaleTranscriptionCleanup({ staleMinutes, dryRun: false });

  if (result.modified > 0) {
    console.log(
      `🧹 [TRANSCRIPTION CLEANUP JOB] Marked ${result.modified} stale transcription job(s) as failed (window: ${result.staleMinutes}m)`
    );
  } else {
    console.log(
      `🧹 [TRANSCRIPTION CLEANUP JOB] No stale transcription jobs found (window: ${result.staleMinutes}m)`
    );
  }

  return result;
};

/**
 * POST /api/meetings/recordings/cleanup-stale
 * Admin-only utility to mark stale pending/processing transcriptions as failed.
 * Query/body options:
 * - staleMinutes (number, default 30, min 5, max 1440)
 * - dryRun (boolean, default false)
 */
export const cleanupStaleTranscriptions = async (req, res) => {
  try {
    const staleMinutes = Number(req.query.staleMinutes || req.body?.staleMinutes || 30);
    const dryRunRaw = String(req.query.dryRun ?? req.body?.dryRun ?? "false").trim().toLowerCase();
    const dryRun = dryRunRaw === "true" || dryRunRaw === "1";
    const result = await executeStaleTranscriptionCleanup({ staleMinutes, dryRun });
    return res.json(result);
  } catch (error) {
    console.error("❌ [CLEANUP STALE TRANSCRIPTIONS] Error:", error.message);
    return res.status(500).json({ error: "Failed to cleanup stale transcriptions" });
  }
};

/**
 * POST /api/meetings/recordings/retry-failed
 * Admin-only batch retry for failed transcription jobs.
 * Query/body options:
 * - mode: "assemblyai" | "local" (default: assemblyai)
 * - limit: number (default 25, min 1, max 200)
 * - onlyCleanupFailed: boolean (default false) -> retry only records failed by stale-cleanup
 */
export const retryFailedTranscriptionsBatch = async (req, res) => {
  try {
    const transcriptionMode = normalizeTranscriptionMode(
      req.query.mode || req.body?.mode || "assemblyai"
    );
    const limitRaw = Number(req.query.limit || req.body?.limit || 25);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
      : 25;

    const onlyCleanupFailedRaw = String(
      req.query.onlyCleanupFailed ?? req.body?.onlyCleanupFailed ?? "false"
    )
      .trim()
      .toLowerCase();
    const onlyCleanupFailed =
      onlyCleanupFailedRaw === "true" || onlyCleanupFailedRaw === "1";

    const filter = {
      transcription_status: "failed",
    };

    if (onlyCleanupFailed) {
      filter.transcription_error = /Marked failed by cleanup/i;
    }

    const failedRecords = await MeetingRecording.find(filter)
      .sort({ updatedAt: 1 })
      .limit(limit)
      .select("_id")
      .lean();

    if (failedRecords.length === 0) {
      return res.json({
        mode: transcriptionMode,
        queued: 0,
        limit,
        onlyCleanupFailed,
        message: "No failed transcription records found for retry.",
      });
    }

    const ids = failedRecords.map((r) => r._id);
    const updateResult = await MeetingRecording.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          transcription_status: "pending",
          transcription_error: null,
        },
      }
    );

    ids.forEach((id) => {
      setImmediate(() => {
        transcribeRecording(id, transcriptionMode).catch((err) => {
          console.error("❌ [BATCH RETRY TRANSCRIPTION] Error:", err.message);
        });
      });
    });

    return res.json({
      mode: transcriptionMode,
      queued: ids.length,
      matched: updateResult.matchedCount,
      modified: updateResult.modifiedCount,
      limit,
      onlyCleanupFailed,
      recordingIds: ids,
    });
  } catch (error) {
    console.error("❌ [BATCH RETRY TRANSCRIPTION] Error:", error.message);
    return res.status(500).json({ error: "Failed to queue batch transcription retry" });
  }
};

/**
 * POST /api/meetings/:id/recordings/:recordingId/chat
 * Chat with AI about the meeting notes and transcript.
 * Body: { message: string, history: [{ role, content }] }
 * Returns: { data: { reply: string } }
 */
export const chatWithNotes = async (req, res) => {
  try {
    const { id: meetingId, recordingId } = req.params;
    const userId = String(req.userId);
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    // Verify meeting access
    const meeting = await Meeting.findById(meetingId).lean();
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const isParticipant =
      String(meeting.host_id) === userId ||
      (Array.isArray(meeting.participants) &&
        meeting.participants.some((p) => String(p) === userId));

    if (!isParticipant) {
      return res.status(403).json({ error: "You are not allowed to access this recording" });
    }

    const recording = await MeetingRecording.findOne({
      _id: recordingId,
      meeting_id: meetingId,
    });

    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    if (!recording.transcript && !recording.meeting_notes) {
      return res.status(400).json({
        error: "No transcript or meeting notes available to chat about.",
      });
    }

    // Build context from transcript and notes
    const contextParts = [];
    if (recording.meeting_notes) {
      contextParts.push(`## Meeting Notes\n${recording.meeting_notes}`);
    }
    if (recording.transcript) {
      contextParts.push(`## Full Transcript\n${recording.transcript}`);
    }
    const meetingContext = contextParts.join("\n\n");

    // Build message history for multi-turn conversation
    const conversationMessages = [
      {
        role: "system",
        content: `You are a helpful meeting assistant. You have access to the notes and transcript of a meeting titled "${meeting.title || "Untitled Meeting"}"${meeting.scheduled_at ? ` held on ${new Date(meeting.scheduled_at).toLocaleString()}` : ""}.

Answer the user's questions based ONLY on the information in the meeting notes and transcript provided below. If the answer is not found in the provided context, say so clearly. Be concise, accurate, and helpful.

--- BEGIN MEETING CONTEXT ---
${meetingContext}
--- END MEETING CONTEXT ---`,
      },
    ];

    // Add previous conversation history (limit to last 20 messages to stay within token limits)
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        conversationMessages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add the current user message
    conversationMessages.push({ role: "user", content: message.trim() });

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: conversationMessages,
      max_tokens: 800,
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Sorry, I could not generate a response.";

    return res.json({ data: { reply } });
  } catch (error) {
    console.error("❌ [NOTES CHAT] Error:", error.message);
    if (error.response) {
      console.error("❌ [NOTES CHAT] Status:", error.response?.status);
      console.error("❌ [NOTES CHAT] Body:", JSON.stringify(error.response?.data || error.response?.body));
    }
    if (error.status) {
      console.error("❌ [NOTES CHAT] API Status:", error.status);
    }
    if (error.error) {
      console.error("❌ [NOTES CHAT] API Error:", JSON.stringify(error.error));
    }
    return res.status(500).json({ error: error.message || "Failed to process chat message" });
  }
};
