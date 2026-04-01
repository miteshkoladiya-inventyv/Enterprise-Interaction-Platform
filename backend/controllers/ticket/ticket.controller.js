import { SupportTicket } from "../../models/SupportTicket.js";
import { Customer } from "../../models/Customer.js";
import { TicketMessage } from "../../models/TicketMessage.js";
import User from "../../models/User.js";
import Employee from "../../models/Employee.js";
import Meeting from "../../models/Meeting.js";
import { broadcastMeetingEvent } from "../../socket/socketServer.js";
import {
  calculatePriorityScore,
  getSLATargets,
  findBestAvailableAgent,
  checkSLABreach,
  escalateTicket,
} from "../../utils/ticketPriority.js";
import {
  buildMeetingCollaborationContext,
  convertScheduledLocalToUtc,
  evaluateCountryFeatureAccess,
} from "../../utils/crossCountryCollaboration.js";

// Generate unique ticket number
function generateTicketNumber() {
  const prefix = "TKT";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Map numeric urgency level (1-5) to string enum
const urgencyLevelToString = (level) => {
  const mapping = { 1: "low", 2: "medium", 3: "high", 4: "critical", 5: "critical" };
  return mapping[level] || "medium";
};

const buildTicketAccessContext = async (ticket, user) => {
  const [customer, employee] = await Promise.all([
    Customer.findOne({ user_id: user._id }).select("_id"),
    Employee.findOne({ user_id: user._id }).select("_id"),
  ]);

  const isAdmin = user.user_type === "admin";
  const isCustomerOwner =
    !!customer &&
    String(ticket.customer_id?._id || ticket.customer_id) === String(customer._id);
  const isAssignedAgent =
    !!employee &&
    String(ticket.assigned_agent_id?._id || ticket.assigned_agent_id) ===
      String(employee._id);
  const isCollaborator =
    !!employee &&
    (ticket.collaborators || []).some((c) => String(c) === String(employee._id));

  return {
    customer,
    employee,
    isAdmin,
    isCustomerOwner,
    isAssignedAgent,
    isCollaborator,
    canAccess: isAdmin || isCustomerOwner || isAssignedAgent || isCollaborator,
    canManage:
      isAdmin || isAssignedAgent || isCollaborator,
  };
};

// Create a new ticket (customer) - with auto-priority calculation and assignment
export const createTicket = async (req, res) => {
  try {
    const { title, description, category, country, urgency_level, subscription_tier } =
      req.body;
    const userId = req.user._id;

    const customer = await Customer.findOne({ user_id: userId });
    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    // Convert urgency level number to string enum
    const urgencyNum = parseInt(urgency_level) || 2;
    const urgencyString = urgencyLevelToString(urgencyNum);

    // Calculate priority based on inputs
    const { priority, score: priorityScore } = calculatePriorityScore(
      subscription_tier || "pro",
      urgencyNum,
      category
    );

    // Get SLA targets
    const slaTargets = getSLATargets(priority);

    // Auto-assign to best available agent
    const assignedAgent = await findBestAvailableAgent(
      null,
      null
    );

    const ticketData = {
      ticket_number: generateTicketNumber(),
      customer_id: customer._id,
      title,
      description,
      priority,
      urgency: urgencyString,
      subscription_tier: subscription_tier || "pro",
      priority_score: priorityScore,
      category,
      country: country || req.user.country,
      status: assignedAgent ? "open" : "pending",
      response_target_minutes: slaTargets.response_target_minutes,
      sla_target_minutes: slaTargets.sla_target_minutes,
    };

    // If agent found, auto-assign
    if (assignedAgent) {
      ticketData.assigned_agent_id = assignedAgent._id;
      ticketData.assigned_at = new Date();
    }

    const ticket = new SupportTicket(ticketData);
    await ticket.save();

    // Create a system message
    let systemMessage = "Ticket created. ";
    if (assignedAgent) {
      const agentName = `${assignedAgent.user_id.first_name} ${assignedAgent.user_id.last_name}`;
      systemMessage += `Auto-assigned to ${agentName}.`;
    } else {
      systemMessage += `Waiting for an agent to be assigned.`;
    }

    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: userId,
      content: systemMessage,
      message_type: "system",
    });

    // Populate for response
    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate({
        path: "assigned_agent_id",
        populate: { path: "user_id", select: "first_name last_name email" },
      });

    res.status(201).json({
      message: "Ticket created successfully",
      ticket: populatedTicket,
      sla_targets: slaTargets,
      priority_score: priorityScore,
      auto_assigned: !!assignedAgent,
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

    const access = await buildTicketAccessContext(ticket, req.user);
    if (!access.canAccess) {
      return res.status(403).json({ error: "Not authorized to view this ticket" });
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
    if (!ticket.assigned_at) {
      ticket.assigned_at = new Date();
    }
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

// Update ticket status - with SLA tracking
export const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const access = await buildTicketAccessContext(ticket, req.user);
    if (!access.canManage) {
      return res.status(403).json({ error: "Not authorized to update this ticket" });
    }

    const oldStatus = ticket.status;
    ticket.status = status;

    // Track SLA timestamps
    if (status === "in_progress" && !ticket.started_at) {
      ticket.started_at = new Date();
    }

    if (status === "resolved") {
      ticket.resolved_at = new Date();
    }

    await ticket.save();

    // System message with SLA info
    let messageContent = `Ticket status changed from "${oldStatus}" to "${status}".`;
    if (status === "in_progress") {
      const elapsedMinutes = ticket.assigned_at
        ? Math.round((new Date() - new Date(ticket.assigned_at)) / (1000 * 60))
        : 0;
      messageContent += ` (Agent started work ${elapsedMinutes} minutes after assignment)`;
    }

    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: req.user._id,
      content: messageContent,
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
    const employee = await Employee.findOne({ user_id: req.user._id }).select("_id");
    if (!employee && req.user.user_type !== "admin") {
      return res.status(403).json({ error: "Not authorized to view employees" });
    }

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

// Send ticket message - with first response tracking
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

    // If agent responds for first time, mark first_response_at
    if ((isAssignedAgent || isCollaborator || isAdmin) && !ticket.first_response_at) {
      ticket.first_response_at = new Date();
    }

    // Update ticket status to in_progress if it was open
    if (ticket.status === "open") {
      ticket.status = "in_progress";
      if (!ticket.started_at) {
        ticket.started_at = new Date();
      }
      await ticket.save();
    } else if (ticket.status === "pending" && (isAssignedAgent || isCollaborator)) {
      // If still pending and agent messages, mark as open
      ticket.status = "open";
      ticket.assigned_at = new Date();
      await ticket.save();
    } else {
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

    const ticket = await SupportTicket.findById(ticketId).select(
      "customer_id assigned_agent_id collaborators"
    );
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const access = await buildTicketAccessContext(ticket, req.user);
    if (!access.canAccess) {
      return res.status(403).json({ error: "Not authorized to view ticket messages" });
    }

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

    const access = await buildTicketAccessContext(ticket, req.user);
    if (!access.canAccess) {
      return res.status(403).json({ error: "Not authorized to upload files to this ticket" });
    }

    const exportPolicy = evaluateCountryFeatureAccess(ticket.country, "data_export", {
      complianceApproved: req.body?.regional_compliance_ack === true,
    });
    if (!exportPolicy.allowed) {
      return res.status(403).json({
        error:
          exportPolicy.reason ||
          "File sharing is restricted by regional data-export policy.",
        policy: exportPolicy,
      });
    }

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
    const {
      title,
      scheduled_at,
      scheduled_date,
      scheduled_time,
      scheduled_timezone,
      duration_minutes = 30,
    } = req.body;
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
    const effectiveTimeZone = scheduled_timezone || req.user?.timezone || "UTC";
    const scheduledDate = scheduled_date && scheduled_time
      ? convertScheduledLocalToUtc(scheduled_date, scheduled_time, effectiveTimeZone)
      : scheduled_at
        ? new Date(scheduled_at)
        : new Date();

    if ((scheduled_date && scheduled_time) || scheduled_at) {
      if (scheduledDate.getTime() < Date.now() - 60 * 1000) {
        return res.status(400).json({
          error: "Meeting date and time must be current or in the future",
        });
      }
    }

    const meeting = await Meeting.create({
      meeting_code: meetingCode,
      title: meetingTitle,
      host_id: userId,
      meeting_type: "support",
      scheduled_at: scheduledDate,
      scheduled_timezone: effectiveTimeZone,
      host_country: req.user?.country || null,
      host_timezone: req.user?.timezone || effectiveTimeZone,
      duration_minutes,
      participants,
      recording_enabled: false,
      open_to_everyone: false,
    });

    // Populate and broadcast so every participant's MeetingModule updates in real-time
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate("host_id", "first_name last_name email country timezone user_type")
      .populate("participants", "first_name last_name email country timezone user_type")
      .lean();
    const meetingWithContext = {
      ...populatedMeeting,
      cross_country_context: buildMeetingCollaborationContext(populatedMeeting),
    };
    broadcastMeetingEvent("created", meetingWithContext);

    // Post meeting system message in ticket chat
    const meetingMeta = JSON.stringify({
      code: meetingCode,
      title: meetingTitle,
      scheduled_at: scheduledDate.toISOString(),
      scheduled_timezone: effectiveTimeZone,
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

    res.status(201).json({ meeting: meetingWithContext, message: populatedMsg });
  } catch (error) {
    console.error("Schedule meeting from ticket error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Submit customer satisfaction rating
export const submitSatisfaction = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const customer = await Customer.findOne({ user_id: userId });
    if (!customer || ticket.customer_id.toString() !== customer._id.toString()) {
      return res.status(403).json({ error: "Only ticket creator can rate" });
    }

    if (ticket.status !== "resolved" && ticket.status !== "closed") {
      return res.status(400).json({ 
        error: "Can only rate resolved or closed tickets" 
      });
    }

    ticket.satisfaction_rating = rating;
    ticket.satisfaction_comment = comment;
    ticket.rated_at = new Date();

    await ticket.save();

    // Create system message
    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: userId,
      content: `Customer rated this ticket: ${rating}/5 stars. ${comment ? `Comment: ${comment}` : ""}`,
      message_type: "system",
    });

    res.json({ 
      message: "Satisfaction rating submitted",
      ticket 
    });
  } catch (error) {
    console.error("Submit satisfaction error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Check SLA status and calculate remaining time
export const checkSLAStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const access = await buildTicketAccessContext(ticket, req.user);
    if (!access.canAccess) {
      return res.status(403).json({ error: "Not authorized to view this ticket SLA" });
    }

    const now = new Date();
    const response = {
      ticket_id: ticketId,
      ticket_number: ticket.ticket_number,
      status: ticket.status,
      priority: ticket.priority,
      sla_target_minutes: ticket.sla_target_minutes,
      response_target_minutes: ticket.response_target_minutes,
      sla_breached: ticket.sla_breached,
      first_response_breached: ticket.first_response_breached,
    };

    // Calculate response SLA
    if (ticket.assigned_at) {
      const assignedTime = new Date(ticket.assigned_at);
      const elapsedMinutes = Math.round((now - assignedTime) / (1000 * 60));
      const remainingMinutes = ticket.response_target_minutes - elapsedMinutes;

      response.response_sla = {
        elapsed_minutes: elapsedMinutes,
        target_minutes: ticket.response_target_minutes,
        remaining_minutes: Math.max(0, remainingMinutes),
        breached: remainingMinutes < 0,
        breach_percentage: (elapsedMinutes / ticket.response_target_minutes) * 100,
      };
    }

    // Calculate overall SLA
    if (ticket.assigned_at && ticket.status !== "resolved" && ticket.status !== "closed") {
      const assignedTime = new Date(ticket.assigned_at);
      const elapsedMinutes = Math.round((now - assignedTime) / (1000 * 60));
      const remainingMinutes = ticket.sla_target_minutes - elapsedMinutes;

      response.overall_sla = {
        elapsed_minutes: elapsedMinutes,
        target_minutes: ticket.sla_target_minutes,
        remaining_minutes: Math.max(0, remainingMinutes),
        breached: remainingMinutes < 0,
        breach_percentage: (elapsedMinutes / ticket.sla_target_minutes) * 100,
      };
    }

    // Show resolution time if resolved
    if (ticket.resolved_at && ticket.assigned_at) {
      const resolvedTime = new Date(ticket.resolved_at);
      const assignedTime = new Date(ticket.assigned_at);
      const resolutionMinutes = Math.round((resolvedTime - assignedTime) / (1000 * 60));

      response.resolution_time = {
        minutes: resolutionMinutes,
        target_minutes: ticket.sla_target_minutes,
        met_sla: resolutionMinutes <= ticket.sla_target_minutes,
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Check SLA status error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Manual ticket escalation (admin/manager)
export const escalateTicketManual = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const escalatedTicket = await escalateTicket(ticket, reason || "Manual escalation by admin");
    await escalatedTicket.save();

    // Create system message
    const levelNames = {
      1: "Team Lead",
      2: "Manager",
      3: "Director"
    };

    await TicketMessage.create({
      ticket_id: ticket._id,
      sender_id: req.user._id,
      content: `Ticket escalated to ${levelNames[escalatedTicket.escalation_level]} level. Reason: ${reason || "Manual escalation"}`,
      message_type: "system",
    });

    res.json({ 
      message: "Ticket escalated successfully",
      ticket: escalatedTicket 
    });
  } catch (error) {
    console.error("Escalate ticket error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get SLA statistics for admin dashboard
export const getSLAStats = async (req, res) => {
  try {
    const allTickets = await SupportTicket.find();

    const stats = {
      total_tickets: allTickets.length,
      by_status: {},
      by_priority: {},
      sla_breaches: 0,
      avg_resolution_time_minutes: 0,
      avg_satisfaction_rating: 0,
    };

    // Count by status and priority
    allTickets.forEach((ticket) => {
      stats.by_status[ticket.status] = (stats.by_status[ticket.status] || 0) + 1;
      stats.by_priority[ticket.priority] = (stats.by_priority[ticket.priority] || 0) + 1;

      if (ticket.sla_breached) stats.sla_breaches += 1;
    });

    // Calculate average resolution time
    const resolvedTickets = allTickets.filter(
      (t) => t.assigned_at && t.resolved_at
    );
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, t) => {
        const time = new Date(t.resolved_at) - new Date(t.assigned_at);
        return sum + time;
      }, 0);
      stats.avg_resolution_time_minutes = Math.round(
        totalTime / resolvedTickets.length / (1000 * 60)
      );
    }

    // Calculate average satisfaction rating
    const ratedTickets = allTickets.filter((t) => t.satisfaction_rating);
    if (ratedTickets.length > 0) {
      const totalRating = ratedTickets.reduce((sum, t) => sum + t.satisfaction_rating, 0);
      stats.avg_satisfaction_rating = parseFloat(
        (totalRating / ratedTickets.length).toFixed(2)
      );
    }

    // Top agents by workload and satisfaction
    const agents = await Employee.find({ employee_type: "customer_support" }).lean();
    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const agentTickets = allTickets.filter(
          (t) => t.assigned_agent_id?.toString() === agent._id.toString()
        );
        const ratedAgentTickets = agentTickets.filter((t) => t.satisfaction_rating);
        const avgRating =
          ratedAgentTickets.length > 0
            ? ratedAgentTickets.reduce((sum, t) => sum + t.satisfaction_rating, 0) /
              ratedAgentTickets.length
            : 0;

        const agentUser = await User.findById(agent.user_id).lean();

        return {
          agent_id: agent._id,
          agent_name: `${agentUser?.first_name || ""} ${agentUser?.last_name || ""}`.trim(),
          assigned_tickets: agentTickets.length,
          resolved_tickets: agentTickets.filter((t) => t.status === "resolved").length,
          avg_satisfaction: parseFloat(avgRating.toFixed(2)),
        };
      })
    );

    stats.agent_stats = agentStats.sort((a, b) => b.resolved_tickets - a.resolved_tickets);

    res.json(stats);
  } catch (error) {
    console.error("Get SLA stats error:", error);
    res.status(500).json({ error: error.message });
  }
};
