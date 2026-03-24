import express from "express";
import {
  requestCall,
  getDirectCallLiveKitToken,
  checkUserOnline,
  checkUserCallStatus,
  startGroupCall,
  getGroupCallLiveKitToken,
  getGroupCallStatus,
  joinGroupCall,
  leaveGroupCall,
  inviteToCall,
} from "../controllers/call/call.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/online/:userId", verifyToken, checkUserOnline);
router.get("/status/:userId", verifyToken, checkUserCallStatus);
router.post("/request", verifyToken, requestCall);
router.post("/livekit-token", verifyToken, getDirectCallLiveKitToken);
router.post("/invite", verifyToken, inviteToCall);

router.post("/group/start", verifyToken, startGroupCall);
router.post("/group/livekit-token", verifyToken, getGroupCallLiveKitToken);
router.get("/group/status/:channelId", verifyToken, getGroupCallStatus);
router.post("/group/join", verifyToken, joinGroupCall);
router.post("/group/leave", verifyToken, leaveGroupCall);

export default router;
