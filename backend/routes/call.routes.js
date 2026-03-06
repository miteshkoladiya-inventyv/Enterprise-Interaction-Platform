import express from "express";
import {
  requestCall,
  checkUserOnline,
  checkUserCallStatus,
  startGroupCall,
  getGroupCallStatus,
  joinGroupCall,
  leaveGroupCall,
} from "../controllers/call/call.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/online/:userId", verifyToken, checkUserOnline);
router.get("/status/:userId", verifyToken, checkUserCallStatus);
router.post("/request", verifyToken, requestCall);

router.post("/group/start", verifyToken, startGroupCall);
router.get("/group/status/:channelId", verifyToken, getGroupCallStatus);
router.post("/group/join", verifyToken, joinGroupCall);
router.post("/group/leave", verifyToken, leaveGroupCall);

export default router;
