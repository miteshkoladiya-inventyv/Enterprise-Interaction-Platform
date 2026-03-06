import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import {
  createWhiteboard,
  getMyWhiteboards,
  getWhiteboardById,
  joinByCode,
  updateWhiteboard,
  saveContent,
  archiveWhiteboard,
  deleteWhiteboard,
} from "../controllers/whiteboard/whiteboard.controller.js";

const router = Router();
router.use(verifyToken);

router.post("/", createWhiteboard);
router.get("/", getMyWhiteboards);
router.get("/join/:code", joinByCode);
router.get("/:id", getWhiteboardById);
router.put("/:id", updateWhiteboard);
router.put("/:id/content", saveContent);
router.patch("/:id/archive", archiveWhiteboard);
router.delete("/:id", deleteWhiteboard);

export default router;
