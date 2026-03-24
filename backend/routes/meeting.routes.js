import express from "express";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";
import {
  createMeeting,
  getMyMeetings,
  getMeetingById,
  getMeetingByCode,
  updateMeeting,
  cancelMeeting,
  joinMeetingById,
  admitToMeeting,
  deleteMeeting,
  getMeetingLiveKitToken,
  getLiveKitDiagnostics,
} from "../controllers/meeting/meeting.controller.js";
import {
  uploadRecording,
  listRecordings,
  generateMeetingNotes,
  retryTranscription,
  stopTranscription,
  chatWithNotes,
  cleanupStaleTranscriptions,
  retryFailedTranscriptionsBatch,
} from "../controllers/meeting/recording.controller.js";
import { uploadMeetingRecording } from "../config/cloudinary.js";

const router = express.Router();

router.post("/", verifyToken, createMeeting);
router.get("/", verifyToken, getMyMeetings);
router.get("/code/:code", verifyToken, getMeetingByCode);
router.get("/join", verifyToken, getMeetingByCode);
router.get("/livekit/diagnostics", verifyToken, isAdmin, getLiveKitDiagnostics);
router.post("/recordings/cleanup-stale", verifyToken, isAdmin, cleanupStaleTranscriptions);
router.post("/recordings/retry-failed", verifyToken, isAdmin, retryFailedTranscriptionsBatch);
router.post("/:id/join", verifyToken, joinMeetingById);
router.post("/:id/livekit-token", verifyToken, getMeetingLiveKitToken);
router.post("/:id/admit", verifyToken, admitToMeeting);
router.get("/:id", verifyToken, getMeetingById);
router.put("/:id", verifyToken, updateMeeting);
router.delete("/:id/permanent", verifyToken, deleteMeeting);
router.delete("/:id", verifyToken, cancelMeeting);

// Recordings: list and upload (host only for upload)
router.get("/:id/recordings", verifyToken, listRecordings);
router.post("/:id/recordings", verifyToken, uploadMeetingRecording.single("recording"), uploadRecording);
router.post("/:id/recordings/:recordingId/generate-notes", verifyToken, generateMeetingNotes);
router.post("/:id/recordings/:recordingId/retry-transcription", verifyToken, retryTranscription);
router.post("/:id/recordings/:recordingId/stop-transcription", verifyToken, stopTranscription);
router.post("/:id/recordings/:recordingId/chat", verifyToken, chatWithNotes);

export default router;

