import { SupportTicket } from "../../models/SupportTicket.js";
import { Customer } from "../../models/Customer.js";
import { TicketMessage } from "../../models/TicketMessage.js";
import User from "../../models/User.js";
import Employee from "../../models/Employee.js";
import Meeting from "../../models/Meeting.js";
import { broadcastMeetingEvent } from "../../socket/socketServer.js";

// Generate unique ticket number
function generateTicketNumber() {
  const prefix = "TKT";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Create a new ticket (customer)
export const createTicket = async (req, res) => {
  try {
    const { title, description, category, country } = req.body;
    const userId = req.user._id;

    const customer = await Customer.findOne({ user_id: userId });
    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const ticket = new SupportTicket({
      ticket_number: generateTicketNumber(),
      customer_id: customer._id,
      title,
      description,
      priority: "medium",
      category,
      country: country || req.user.country,
      status: "pending",
    });

    await ticket.save();

    // Create a system message
    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: userId,
      content: "Ticket created. Waiting for an agent to be assigned.",
      message_type: "system",
    });

    res.status(201).json({
      message: "Ticket created successfully",
      ticket,
    });
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get tickets for customer
export const getMyTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const customer = await Customer.findOne({ user_id: userId });
    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const tickets = await SupportTicket.find({ customer_id: customer._id })
      .populate({
        path: "assigned_agent_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .sort({ created_at: -1 });

    res.json({ tickets });
  } catch (error) {
    console.error("Get my tickets error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all tickets (admin)
export const getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .populate({
        path: "customer_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .populate({
        path: "assigned_agent_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .sort({ created_at: -1 });

    res.json({ tickets });
  } catch (error) {
    console.error("Get all tickets error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get single ticket
export const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findById(ticketId)
      .populate({
        path: "customer_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .populate({
        path: "assigned_agent_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({ ticket });
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Assign ticket to an internal employee (admin)
export const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { employee_id } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const employee = await Employee.findById(employee_id).populate(
      "user_id",
      "first_name last_name"
    );
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    ticket.assigned_agent_id = employee._id;
    ticket.status = "open";
    await ticket.save();

    // System message
    const agentName = `${employee.user_id.first_name} ${employee.user_id.last_name}`;
    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: req.user._id,
      content: `Ticket assigned to ${agentName}. You can now chat to resolve this issue.`,
      message_type: "system",
    });

    const updatedTicket = await SupportTicket.findById(ticketId)
      .populate({
        path: "customer_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .populate({
        path: "assigned_agent_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      });

    res.json({
      message: "Ticket assigned successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Assign ticket error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update ticket status
export const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    ticket.status = status;
    if (status === "resolved") {
      ticket.resolved_at = new Date();
    }
    await ticket.save();

    // System message
    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: req.user._id,
      content: `Ticket status changed to "${status}".`,
      message_type: "system",
    });

    res.json({ message: "Ticket status updated", ticket });
  } catch (error) {
    console.error("Update ticket status error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update ticket priority (admin)
export const updateTicketPriority = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { priority } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    ticket.priority = priority;
    await ticket.save();

    res.json({ message: "Ticket priority updated", ticket });
  } catch (error) {
    console.error("Update ticket priority error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get customer_support employees for ticket assignment (admin)
export const getInternalEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ employee_type: "customer_support", is_active: true })
      .populate("user_id", "first_name last_name email");

    res.json({ employees });
  } catch (error) {
    console.error("Get internal employees error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all active employees for collaborator selection (assigned agent)
export const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ is_active: true })
      .populate("user_id", "first_name last_name email");

    res.json({ employees });
  } catch (error) {
    console.error("Get all employees error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Add a collaborator to a ticket (assigned customer_support agent only)
export const addCollaborator = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { employee_id } = req.body;
    const userId = req.user._id;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Only the assigned agent can add collaborators
    const requestingEmployee = await Employee.findOne({ user_id: userId });
    if (
      !requestingEmployee ||
      ticket.assigned_agent_id?.toString() !== requestingEmployee._id.toString()
    ) {
      return res.status(403).json({ error: "Only the assigned agent can add collaborators" });
    }

    const collaborator = await Employee.findById(employee_id).populate(
      "user_id",
      "first_name last_name"
    );
    if (!collaborator) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Avoid duplicates
    if (ticket.collaborators.some((c) => c.toString() === employee_id)) {
      return res.status(400).json({ error: "Employee is already a collaborator" });
    }

    ticket.collaborators.push(employee_id);
    await ticket.save();

    const collabName = `${collaborator.user_id.first_name} ${collaborator.user_id.last_name}`;
    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: userId,
      content: `${collabName} was added as a collaborator.`,
      message_type: "system",
    });

    res.json({ message: "Collaborator added successfully", ticket });
  } catch (error) {
    console.error("Add collaborator error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Remove a collaborator from a ticket (assigned customer_support agent only)
export const removeCollaborator = async (req, res) => {
  try {
    const { ticketId, employeeId } = req.params;
    const userId = req.user._id;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Only the assigned agent can remove collaborators
    const requestingEmployee = await Employee.findOne({ user_id: userId });
    if (
      !requestingEmployee ||
      ticket.assigned_agent_id?.toString() !== requestingEmployee._id.toString()
    ) {
      return res.status(403).json({ error: "Only the assigned agent can remove collaborators" });
    }

    const idx = ticket.collaborators.findIndex(
      (c) => c.toString() === employeeId
    );
    if (idx === -1) {
      return res.status(404).json({ error: "Collaborator not found on this ticket" });
    }

    const collaborator = await Employee.findById(employeeId).populate(
      "user_id",
      "first_name last_name"
    );

    ticket.collaborators.splice(idx, 1);
    await ticket.save();

    const collabName = collaborator
      ? `${collaborator.user_id.first_name} ${collaborator.user_id.last_name}`
      : "A collaborator";
    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: userId,
      content: `${collabName} was removed as a collaborator.`,
      message_type: "system",
    });

    res.json({ message: "Collaborator removed successfully", ticket });
  } catch (error) {
    console.error("Remove collaborator error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get tickets assigned to or collaborated on by current employee
export const getAssignedTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const employee = await Employee.findOne({ user_id: userId });
    if (!employee) {
      return res.status(404).json({ error: "Employee profile not found" });
    }

    const tickets = await SupportTicket.find({
      $or: [
        { assigned_agent_id: employee._id },
        { collaborators: employee._id },
      ],
    })
      .populate({
        path: "customer_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      })
      .populate({
        path: "assigned_agent_id",
        populate: { path: "user_id", select: "first_name last_name" },
      })
      .populate({
        path: "collaborators",
        populate: { path: "user_id", select: "first_name last_name" },
      })
      .sort({ created_at: -1 });

    res.json({ tickets });
  } catch (error) {
    console.error("Get assigned tickets error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Send ticket message
export const sendTicketMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Verify sender is related to ticket
    const customer = await Customer.findOne({ user_id: userId });
    const employee = await Employee.findOne({ user_id: userId });
    const isAdmin = req.user.user_type === "admin";

    const isCustomerOwner = customer && ticket.customer_id.toString() === customer._id.toString();
    const isAssignedAgent =
      employee && ticket.assigned_agent_id?.toString() === employee._id.toString();
    const isCollaborator =
      employee && ticket.collaborators.some((c) => c.toString() === employee._id.toString());

    if (!isCustomerOwner && !isAssignedAgent && !isCollaborator && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to send messages in this ticket" });
    }

    // Update ticket status to in_progress if it was open
    if (ticket.status === "open") {
      ticket.status = "in_progress";
      await ticket.save();
    }

    const message = await TicketMessage.create({
      ticket_id: ticketId,
      sender_id: userId,
      content,
      message_type: "text",
    });

    const populatedMessage = await TicketMessage.findById(message._id).populate(
      "sender_id",
      "first_name last_name user_type profile_picture"
    );

    res.status(201).json({ message: populatedMessage });
  } catch (error) {
    console.error("Send ticket message error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get ticket messages
export const getTicketMessages = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const messages = await TicketMessage.find({ ticket_id: ticketId })
      .populate("sender_id", "first_name last_name user_type profile_picture")
      .sort({ created_at: 1 });

    res.json({ messages });
  } catch (error) {
    console.error("Get ticket messages error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Upload file in ticket chat
export const uploadTicketFile = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user._id;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const message = await TicketMessage.create({
      ticket_id: ticketId,
      sender_id: userId,
      content: req.file.originalname,
      file_url: req.file.path,
      file_name: req.file.originalname,
      message_type: "file",
    });

    const populated = await TicketMessage.findById(message._id).populate(
      "sender_id",
      "first_name last_name user_type profile_picture"
    );

    res.status(201).json({ message: populated });
  } catch (error) {
    console.error("Upload ticket file error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Schedule a support meeting from a ticket (assigned agent / collaborator / admin)
export const scheduleMeetingFromTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { title, scheduled_at, duration_minutes = 30 } = req.body;
    const userId = req.user._id;

    const ticket = await SupportTicket.findById(ticketId).populate({
      path: "customer_id",
      populate: { path: "user_id", select: "_id first_name last_name" },
    });
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const employee = await Employee.findOne({ user_id: userId });
    const isAssigned =
      employee && ticket.assigned_agent_id?.toString() === employee._id.toString();
    const isCollab =
      employee &&
      ticket.collaborators.some((c) => c.toString() === employee._id.toString());
    const isAdmin = req.user.user_type === "admin";

    if (!isAssigned && !isCollab && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to schedule meetings" });
    }

    // Generate unique meeting code
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let meetingCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = Array.from({ length: 8 }, () =>
        alphabet[Math.floor(Math.random() * alphabet.length)]
      ).join("");
      const existing = await Meeting.findOne({ meeting_code: candidate });
      if (!existing) { meetingCode = candidate; break; }
    }
    if (!meetingCode) meetingCode = `MTG-${Date.now()}`;

    const customerUserId = ticket.customer_id?.user_id?._id;
    const participants = customerUserId ? [customerUserId] : [];

    // Add collaborator employee user_ids as participants so the meeting
    // appears in their calendar / meetings tab as well.
    if (ticket.collaborators && ticket.collaborators.length > 0) {
      const collabEmployees = await Employee.find({
        _id: { $in: ticket.collaborators },
      }).select("user_id");
      for (const emp of collabEmployees) {
        if (emp.user_id && !participants.some((p) => p.toString() === emp.user_id.toString())) {
          participants.push(emp.user_id);
        }
      }
    }

    // Also add the assigned agent if they are not the host
    if (ticket.assigned_agent_id) {
      const assignedEmp = await Employee.findById(ticket.assigned_agent_id).select("user_id");
      if (
        assignedEmp?.user_id &&
        assignedEmp.user_id.toString() !== userId.toString() &&
        !participants.some((p) => p.toString() === assignedEmp.user_id.toString())
      ) {
        participants.push(assignedEmp.user_id);
      }
    }

    const meetingTitle = title || `Support: ${ticket.ticket_number}`;
    const scheduledDate = scheduled_at ? new Date(scheduled_at) : new Date();

    const meeting = await Meeting.create({
      meeting_code: meetingCode,
      title: meetingTitle,
      host_id: userId,
      meeting_type: "support",
      scheduled_at: scheduledDate,
      duration_minutes,
      participants,
      recording_enabled: false,
      open_to_everyone: false,
    });

    // Populate and broadcast so every participant's MeetingModule updates in real-time
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("host_id", "first_name last_name email")
      .populate("participants", "first_name last_name email")
      .lean();
    broadcastMeetingEvent("created", populatedMeeting);

    // Post meeting system message in ticket chat
    const meetingMeta = JSON.stringify({
      code: meetingCode,
      title: meetingTitle,
      scheduled_at: scheduledDate.toISOString(),
      duration: duration_minutes,
    });

    const sysMsg = await TicketMessage.create({
      ticket_id: ticketId,
      sender_id: userId,
      content: meetingMeta,
      message_type: "meeting",
    });

    const populatedMsg = await TicketMessage.findById(sysMsg._id).populate(
      "sender_id",
      "first_name last_name user_type profile_picture"
    );

    res.status(201).json({ meeting: populatedMeeting, message: populatedMsg });
  } catch (error) {
    console.error("Schedule meeting from ticket error:", error);
    res.status(500).json({ error: error.message });
  }
};
