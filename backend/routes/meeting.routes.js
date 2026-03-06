import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
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
} from "../controllers/meeting/meeting.controller.js";
import { uploadRecording, listRecordings, generateMeetingNotes, retryTranscription, chatWithNotes } from "../controllers/meeting/recording.controller.js";
import { uploadMeetingRecording } from "../config/cloudinary.js";

const router = express.Router();

router.post("/", verifyToken, createMeeting);
router.get("/", verifyToken, getMyMeetings);
router.get("/code/:code", verifyToken, getMeetingByCode);
router.get("/join", verifyToken, getMeetingByCode);
router.post("/:id/join", verifyToken, joinMeetingById);
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
router.post("/:id/recordings/:recordingId/chat", verifyToken, chatWithNotes);

export default router;

