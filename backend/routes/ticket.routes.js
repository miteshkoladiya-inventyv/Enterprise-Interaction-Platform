import express from "express";
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicket,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  getInternalEmployees,
  getAllEmployees,
  addCollaborator,
  removeCollaborator,
  getAssignedTickets,
  sendTicketMessage,
  getTicketMessages,
  uploadTicketFile,
  scheduleMeetingFromTicket,
} from "../controllers/ticket/ticket.controller.js";
import { verifyToken, requirePermission } from "../middlewares/auth.middleware.js";
import { upload } from "../config/cloudinary.js";

const router = express.Router();

// Customer routes
router.post("/", verifyToken, createTicket);
router.get("/my-tickets", verifyToken, getMyTickets);

// Employee routes (assigned tickets + collaborator actions)
router.get("/assigned", verifyToken, getAssignedTickets);
router.get("/all-employees", verifyToken, getAllEmployees);
router.post("/:ticketId/collaborators", verifyToken, addCollaborator);
router.delete("/:ticketId/collaborators/:employeeId", verifyToken, removeCollaborator);

// Admin/permission-based routes
router.get("/all", verifyToken, requirePermission("tickets:manage"), getAllTickets);
router.put("/:ticketId/assign", verifyToken, requirePermission("tickets:assign"), assignTicket);
router.put("/:ticketId/priority", verifyToken, requirePermission("tickets:manage"), updateTicketPriority);
router.get("/internal-employees", verifyToken, requirePermission("tickets:assign"), getInternalEmployees);

// Shared routes
router.get("/:ticketId", verifyToken, getTicket);
router.put("/:ticketId/status", verifyToken, updateTicketStatus);

// Ticket chat
router.post("/:ticketId/messages", verifyToken, sendTicketMessage);
router.post("/:ticketId/messages/upload", verifyToken, upload.single("file"), uploadTicketFile);
router.get("/:ticketId/messages", verifyToken, getTicketMessages);

// Ticket meeting scheduling
router.post("/:ticketId/schedule-meeting", verifyToken, scheduleMeetingFromTicket);

export default router;
