/**
 * Background job to check SLA breaches and auto-escalate tickets
 * Should run periodically (e.g., every 5 minutes)
 */
import { SupportTicket } from "../models/SupportTicket.js";
import { TicketMessage } from "../models/TicketMessage.js";
import { checkSLABreach, escalateTicket } from "../utils/ticketPriority.js";

const SLA_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes

/**
 * Check all active tickets for SLA breaches and auto-escalate if needed
 */
export const runTicketSlaJob = async () => {
  try {
    console.log("[TICKET SLA] Starting SLA breach check job...");
    const now = new Date();

    // Find tickets that are active and could be breaching SLA
    const activeTickets = await SupportTicket.find({
      status: { $in: ["pending", "open", "in_progress"] },
      assigned_at: { $ne: null },
    });

    let responseBreaches = 0;
    let slaBreaches = 0;
    let escalated = 0;

    for (const ticket of activeTickets) {
      let needsSave = false;

      // Check first response SLA breach
      if (!ticket.first_response_breached && !ticket.first_response_at) {
        const assignedTime = new Date(ticket.assigned_at);
        const elapsedMinutes = (now - assignedTime) / (1000 * 60);

        if (elapsedMinutes > ticket.response_target_minutes) {
          ticket.first_response_breached = true;
          responseBreaches++;
          needsSave = true;

          // Create system message for first response breach
          await TicketMessage.create({
            ticket_id: ticket._id,
            sender_id: ticket.assigned_agent_id || ticket.customer_id,
            content: `⚠️ First response SLA breached. Target was ${ticket.response_target_minutes} minutes.`,
            message_type: "system",
          });
        }
      }

      // Check overall SLA breach and escalate
      if (!ticket.sla_breached) {
        const assignedTime = new Date(ticket.assigned_at);
        const elapsedMinutes = (now - assignedTime) / (1000 * 60);

        if (elapsedMinutes > ticket.sla_target_minutes) {
          ticket.sla_breached = true;
          slaBreaches++;
          needsSave = true;

          // Auto-escalate on SLA breach
          const escalatedTicket = await escalateTicket(
            ticket,
            `Automatic escalation: SLA breached (${Math.round(elapsedMinutes)} minutes elapsed, target was ${ticket.sla_target_minutes} minutes)`
          );

          if (escalatedTicket.is_escalated) {
            escalated++;

            const levelNames = {
              1: "Team Lead",
              2: "Manager",
              3: "Director",
            };

            // Create system message for escalation
            await TicketMessage.create({
              ticket_id: ticket._id,
              sender_id: ticket.assigned_agent_id || ticket.customer_id,
              content: `🚨 SLA breached! Ticket auto-escalated to ${levelNames[escalatedTicket.escalation_level] || "higher level"}.`,
              message_type: "system",
            });
          }
        }
      }

      // Check for warning threshold (80% of SLA time) - only warn once
      if (!ticket.sla_breached && !ticket._sla_warning_sent) {
        const assignedTime = new Date(ticket.assigned_at);
        const elapsedMinutes = (now - assignedTime) / (1000 * 60);
        const warningThreshold = ticket.sla_target_minutes * 0.8;

        if (elapsedMinutes > warningThreshold) {
          const remainingMinutes = Math.round(ticket.sla_target_minutes - elapsedMinutes);
          
          await TicketMessage.create({
            ticket_id: ticket._id,
            sender_id: ticket.assigned_agent_id || ticket.customer_id,
            content: `⏰ SLA Warning: ${remainingMinutes} minutes remaining before SLA breach.`,
            message_type: "system",
          });
          
          // Mark warning as sent (we use a temporary flag that doesn't persist)
          ticket._sla_warning_sent = true;
        }
      }

      if (needsSave) {
        await ticket.save();
      }
    }

    console.log(`[TICKET SLA] Job completed - Checked: ${activeTickets.length}, Response breaches: ${responseBreaches}, SLA breaches: ${slaBreaches}, Escalated: ${escalated}`);
  } catch (error) {
    console.error("[TICKET SLA] Error:", error.message);
  }
};

/**
 * Start periodic SLA check job
 * Call this from server initialization
 */
export const startTicketSlaScheduler = () => {
  const enabled = String(process.env.ENABLE_TICKET_SLA_CHECK ?? "true").trim().toLowerCase() !== "false";
  
  if (!enabled) {
    console.log("[TICKET SLA] Scheduler disabled via ENABLE_TICKET_SLA_CHECK=false");
    return null;
  }

  console.log("[TICKET SLA] Scheduler started (interval: 5 minutes)");

  // Run after 1 minute on startup (let other services initialize first)
  setTimeout(runTicketSlaJob, 60 * 1000);

  // Then run periodically
  const intervalId = setInterval(runTicketSlaJob, SLA_CHECK_INTERVAL_MS);

  return intervalId;
};
