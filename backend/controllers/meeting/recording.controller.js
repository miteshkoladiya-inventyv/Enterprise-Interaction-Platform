import Meeting from "../../models/Meeting.js";
import MeetingRecording from "../../models/MeetingRecording.js";
import { cloudinary } from "../../config/cloudinary.js";
import OpenAI from "openai";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { evaluateCountryFeatureAccess } from "../../utils/crossCountryCollaboration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to local Whisper venv Python binary and transcription script
const WHISPER_PYTHON = process.env.WHISPER_PYTHON_PATH || "/home/hett/tools/experimentals/whisper/venv/bin/python3";
const WHISPER_SCRIPT = path.resolve(__dirname, "../../scripts/whisper_transcribe.py");
const WHISPER_MODEL = process.env.WHISPER_MODEL || "small";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      transcription_status: "pending",
    });
    await recording.save();

    console.log(`✅ [RECORDING UPLOAD] Saved to DB (id: ${recording._id})`);
    console.log(`🔗 [RECORDING UPLOAD] Cloudinary URL: ${result.secure_url}`);
    console.log(`🎙️  [RECORDING UPLOAD] Kicking off background transcription...`);

    // Kick off transcription in the background (don't block the response)
    transcribeRecording(recording._id, req.file.buffer).catch((err) => {
      console.error("❌ [TRANSCRIPTION] Background transcription error:", err);
    });

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
 * Background helper: transcribe a recording using OpenAI Whisper, then update the DB record.
 */
async function transcribeRecording(recordingId, fileBuffer) {
  console.log(`\n🎙️  [TRANSCRIPTION] Starting for recording ${recordingId}`);
  console.log(`📊 [TRANSCRIPTION] File buffer size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  const recording = await MeetingRecording.findById(recordingId);
  if (!recording) {
    console.log(`❌ [TRANSCRIPTION] Recording ${recordingId} not found in DB, aborting`);
    return;
  }

  try {
    recording.transcription_status = "processing";
    await recording.save();
    console.log(`⏳ [TRANSCRIPTION] Status set to 'processing'`);

    // Write buffer to a temporary file (OpenAI SDK requires a file path / readable stream)
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `rec-${recordingId}-${Date.now()}.webm`);
    fs.writeFileSync(tmpFile, fileBuffer);
    console.log(`💾 [TRANSCRIPTION] Temp file written: ${tmpFile}`);

    try {
      console.log(`🔄 [TRANSCRIPTION] Sending to OpenAI Whisper API (model: whisper-1)...`);
      const startTime = Date.now();

      // Use Whisper to transcribe with timestamps
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpFile),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏱️  [TRANSCRIPTION] Whisper API responded in ${elapsed}s`);

      const fullText = transcription.text || "";

      // Extract segment-level timestamps
      const segments = (transcription.segments || []).map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text?.trim() || "",
      }));

      console.log(`📝 [TRANSCRIPTION] Full transcript length: ${fullText.length} chars`);
      console.log(`🔢 [TRANSCRIPTION] Segments extracted: ${segments.length}`);
      if (fullText.length > 0) {
        console.log(`📝 [TRANSCRIPTION] Preview: "${fullText.substring(0, 150)}${fullText.length > 150 ? '...' : ''}"`);
      } else {
        console.log(`⚠️  [TRANSCRIPTION] Transcript is empty (silent audio or unrecognizable speech)`);
      }

      recording.transcript = fullText;
      recording.transcript_segments = segments;
      recording.transcription_status = "completed";
      await recording.save();

      console.log(`✅ [TRANSCRIPTION] Completed and saved for recording ${recordingId}`);
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tmpFile);
        console.log(`🧹 [TRANSCRIPTION] Temp file cleaned up`);
      } catch {
        // ignore cleanup errors
      }
    }
  } catch (error) {
    console.error(`❌ [TRANSCRIPTION] Failed for recording ${recordingId}:`, error.message);
    if (error.response) {
      console.error(`❌ [TRANSCRIPTION] API response status: ${error.response.status}`);
      console.error(`❌ [TRANSCRIPTION] API response data:`, error.response.data);
    }
    recording.transcription_status = "failed";
    await recording.save();
    console.log(`⚠️  [TRANSCRIPTION] Status set to 'failed'`);
  }
}

/**
 * Background helper: transcribe a recording using local Whisper (Python subprocess), then update the DB record.
 */
async function transcribeRecordingLocal(recordingId, fileBuffer) {
  console.log(`\n🎙️  [LOCAL TRANSCRIPTION] Starting for recording ${recordingId}`);
  console.log(`📊 [LOCAL TRANSCRIPTION] File buffer size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  const recording = await MeetingRecording.findById(recordingId);
  if (!recording) {
    console.log(`❌ [LOCAL TRANSCRIPTION] Recording ${recordingId} not found in DB, aborting`);
    return;
  }

  try {
    recording.transcription_status = "processing";
    await recording.save();
    console.log(`⏳ [LOCAL TRANSCRIPTION] Status set to 'processing'`);

    // Write buffer to a temporary file
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `rec-${recordingId}-${Date.now()}.webm`);
    fs.writeFileSync(tmpFile, fileBuffer);
    console.log(`💾 [LOCAL TRANSCRIPTION] Temp file written: ${tmpFile}`);

    try {
      console.log(`🔄 [LOCAL TRANSCRIPTION] Spawning local Whisper (model: ${WHISPER_MODEL})...`);
      console.log(`🐍 [LOCAL TRANSCRIPTION] Python: ${WHISPER_PYTHON}`);
      console.log(`📜 [LOCAL TRANSCRIPTION] Script: ${WHISPER_SCRIPT}`);
      const startTime = Date.now();

      const result = await new Promise((resolve, reject) => {
        execFile(
          WHISPER_PYTHON,
          [WHISPER_SCRIPT, tmpFile, "--model", WHISPER_MODEL],
          { timeout: 10 * 60 * 1000, maxBuffer: 50 * 1024 * 1024 }, // 10 min timeout, 50MB buffer
          (error, stdout, stderr) => {
            if (stderr) {
              // Whisper prints progress to stderr, log it
              stderr.split("\n").filter(Boolean).forEach((line) => {
                console.log(`🐍 [LOCAL TRANSCRIPTION] ${line}`);
              });
            }
            if (error) {
              reject(new Error(error.message || "Whisper process failed"));
              return;
            }
            try {
              // Whisper may print extra lines to stdout (e.g. "Detected language: English")
              // so extract the last line that looks like valid JSON
              const lines = stdout.trim().split("\n");
              let parsed = null;
              for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (line.startsWith("{")) {
                  try { parsed = JSON.parse(line); break; } catch { /* try previous line */ }
                }
              }
              if (!parsed) parsed = JSON.parse(stdout.trim()); // fallback: try full output
              resolve(parsed);
            } catch (parseErr) {
              reject(new Error(`Failed to parse Whisper output: ${stdout.substring(0, 500)}`));
            }
          }
        );
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏱️  [LOCAL TRANSCRIPTION] Whisper completed in ${elapsed}s`);

      const fullText = result.text || "";
      const segments = (result.segments || []).map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text?.trim() || "",
      }));

      console.log(`📝 [LOCAL TRANSCRIPTION] Full transcript length: ${fullText.length} chars`);
      console.log(`🔢 [LOCAL TRANSCRIPTION] Segments extracted: ${segments.length}`);
      if (fullText.length > 0) {
        console.log(`📝 [LOCAL TRANSCRIPTION] Preview: "${fullText.substring(0, 150)}${fullText.length > 150 ? '...' : ''}"`);
      } else {
        console.log(`⚠️  [LOCAL TRANSCRIPTION] Transcript is empty (silent audio or unrecognizable speech)`);
      }

      recording.transcript = fullText;
      recording.transcript_segments = segments;
      recording.transcription_status = "completed";
      await recording.save();

      console.log(`✅ [LOCAL TRANSCRIPTION] Completed and saved for recording ${recordingId}`);
    } finally {
      try {
        fs.unlinkSync(tmpFile);
        console.log(`🧹 [LOCAL TRANSCRIPTION] Temp file cleaned up`);
      } catch {
        // ignore cleanup errors
      }
    }
  } catch (error) {
    console.error(`❌ [LOCAL TRANSCRIPTION] Failed for recording ${recordingId}:`, error.message);
    recording.transcription_status = "failed";
    await recording.save();
    console.log(`⚠️  [LOCAL TRANSCRIPTION] Status set to 'failed'`);
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
 * Retry/start transcription for a recording (re-downloads from Cloudinary).
 * Query param: ?mode=local (use local Whisper) or ?mode=online (use OpenAI API). Default: local.
 */
export const retryTranscription = async (req, res) => {
  try {
    const { id: meetingId, recordingId } = req.params;
    const userId = String(req.userId);
    const mode = req.query.mode === "online" ? "online" : "local";

    console.log(`\n🔄 [RETRY TRANSCRIPTION] Requested for recording ${recordingId} (meeting: ${meetingId}) [mode: ${mode}]`);

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

    if (recording.transcription_status === "processing") {
      console.log(`⚠️  [RETRY TRANSCRIPTION] Already processing, skipping`);
      return res.status(400).json({ error: "Transcription is already in progress" });
    }

    // Validate local Whisper availability if local mode
    if (mode === "local") {
      if (!fs.existsSync(WHISPER_PYTHON)) {
        console.log(`❌ [RETRY TRANSCRIPTION] Local Whisper Python not found: ${WHISPER_PYTHON}`);
        return res.status(400).json({
          error: "Local Whisper is not configured. Python binary not found at: " + WHISPER_PYTHON,
          hint: "Set WHISPER_PYTHON_PATH environment variable or use mode=online",
        });
      }
      if (!fs.existsSync(WHISPER_SCRIPT)) {
        console.log(`❌ [RETRY TRANSCRIPTION] Whisper script not found: ${WHISPER_SCRIPT}`);
        return res.status(400).json({
          error: "Local Whisper transcription script not found",
        });
      }
    }

    console.log(`🔄 [RETRY TRANSCRIPTION] Downloading recording from Cloudinary...`);

    // Download the recording from Cloudinary and re-transcribe
    recording.transcription_status = "processing";
    await recording.save();

    // Fetch the file from Cloudinary
    const response = await fetch(recording.cloudinary_url);
    if (!response.ok) {
      console.log(`❌ [RETRY TRANSCRIPTION] Failed to download from Cloudinary (status: ${response.status})`);
      recording.transcription_status = "failed";
      await recording.save();
      return res.status(500).json({ error: "Failed to download recording from storage" });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`✅ [RETRY TRANSCRIPTION] Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB from Cloudinary`);
    console.log(`🎙️  [RETRY TRANSCRIPTION] Kicking off ${mode} transcription...`);

    // Kick off transcription in background
    const transcribeFn = mode === "local" ? transcribeRecordingLocal : transcribeRecording;
    transcribeFn(recording._id, buffer).catch((err) => {
      console.error(`❌ [RETRY TRANSCRIPTION] ${mode} error:`, err.message);
    });

    return res.json({ message: `Transcription started (${mode})`, transcription_status: "processing", mode });
  } catch (error) {
    console.error("❌ [RETRY TRANSCRIPTION] Error:", error.message);
    return res.status(500).json({ error: "Failed to retry transcription" });
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
