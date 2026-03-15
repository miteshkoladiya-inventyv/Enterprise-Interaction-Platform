import Employee from "../models/Employee.js";

/**
 * Calculate priority score based on subscription tier, urgency, and category
 * Returns: { priority: "low|medium|high|critical", score: number }
 */
export const calculatePriorityScore = (subscription_tier, urgency, category) => {
  let score = 0;

  // Subscription tier weight (40%)
  const tierScores = {
    starter: 1,
    pro: 2,
    enterprise: 5, // High weight for enterprise
  };
  const tierScore = tierScores[subscription_tier] || 2;
  score += tierScore * 0.4;

  // Urgency level weight (40%)
  const urgencyScore = urgency || 2; // 1-5 scale
  score += urgencyScore * 0.4;

  // Category boost (20%)
  let categoryBoost = 0;
  if (category) {
    const catLower = category.toLowerCase();
    if (catLower.includes("security")) categoryBoost = 2;
    else if (catLower.includes("billing") || catLower.includes("payment"))
      categoryBoost = 1;
    else if (catLower.includes("integration")) categoryBoost = 0.5;
    else if (catLower.includes("feature")) categoryBoost = -0.5;
    else categoryBoost = 0;
  }
  score += (2 + categoryBoost) * 0.2;

  // Determine priority level
  let priority = "low";
  if (score <= 1.2) priority = "low";
  else if (score <= 2.4) priority = "medium";
  else if (score <= 3.6) priority = "high";
  else priority = "critical";

  return { priority, score: parseFloat(score.toFixed(2)) };
};

/**
 * Get SLA targets based on priority
 * Returns: { response_target_minutes, sla_target_minutes }
 */
export const getSLATargets = (priority) => {
  const slaMap = {
    low: { response_target_minutes: 480, sla_target_minutes: 2880 }, // 8h response, 48h resolution
    medium: { response_target_minutes: 240, sla_target_minutes: 1440 }, // 4h response, 24h resolution
    high: { response_target_minutes: 60, sla_target_minutes: 480 }, // 1h response, 8h resolution
    critical: { response_target_minutes: 15, sla_target_minutes: 120 }, // 15m response, 2h resolution
  };

  return slaMap[priority] || slaMap["medium"];
};

/**
 * Find the best available agent for ticket assignment
 * Strategy: Agent with lowest current workload + available + matching category/department
 */
export const findBestAvailableAgent = async (ticket, department_id) => {
  try {
    // Get all active customer support agents
    const agents = await Employee.find({
      employee_type: "customer_support",
      is_active: true,
    }).populate("user_id", "first_name last_name");

    if (agents.length === 0) return null;

    // Get current workload for each agent
    const { SupportTicket } = await import("../models/SupportTicket.js");

    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const assignedCount = await SupportTicket.countDocuments({
          assigned_agent_id: agent._id,
          status: { $in: ["pending", "open", "in_progress"] },
        });

        const activeMessages = await SupportTicket.countDocuments({
          collaborators: agent._id,
          status: { $in: ["open", "in_progress"] },
        });

        return {
          agent,
          workload: assignedCount + activeMessages * 0.5, // Collaborations count as half
        };
      })
    );

    // Sort by lowest workload
    agentStats.sort((a, b) => a.workload - b.workload);

    // Return agent with lowest workload
    return agentStats[0].agent;
  } catch (error) {
    console.error("Error finding best agent:", error);
    return null;
  }
};

/**
 * Check and handle SLA breaches
 * Escalates ticket if SLA is about to breach or has breached
 */
export const checkSLABreach = async (ticket, escalateCallback) => {
  const now = new Date();

  // Check first response SLA
  if (ticket.assigned_at && !ticket.first_response_breached) {
    const assignedTime = new Date(ticket.assigned_at);
    const elapsedMinutes = (now - assignedTime) / (1000 * 60);

    if (elapsedMinutes > ticket.response_target_minutes) {
      ticket.first_response_breached = true;
    }
  }

  // Check overall SLA
  if (ticket.assigned_at && !ticket.sla_breached) {
    const assignedTime = new Date(ticket.assigned_at);
    const elapsedMinutes = (now - assignedTime) / (1000 * 60);

    if (elapsedMinutes > ticket.sla_target_minutes) {
      ticket.sla_breached = true;

      // Trigger escalation
      if (escalateCallback) {
        await escalateCallback(ticket);
      }
    }
  }

  return ticket;
};

/**
 * Auto-escalate ticket based on inactivity or SLA breach
 * Escalation ladder: agent -> team_lead -> manager -> director
 */
export const escalateTicket = async (ticket, reason) => {
  const { Employee: EmployeeModel } = await import("../models/Employee.js");

  try {
    let nextEscalationLevel = (ticket.escalation_level || 0) + 1;
    let escalatedTo = null;

    if (nextEscalationLevel <= 3) {
      ticket.escalation_level = nextEscalationLevel;
      ticket.is_escalated = true;

      // Determine who to escalate to based on level
      if (nextEscalationLevel === 1) {
        // Escalate to team lead of the assigned agent's department
        if (ticket.assigned_agent_id) {
          const currentAgent = await EmployeeModel.findById(
            ticket.assigned_agent_id
          );
          if (currentAgent && currentAgent.department_id) {
            escalatedTo = await EmployeeModel.findOne({
              department_id: currentAgent.department_id,
              designation: { $in: ["team_lead", "lead"] },
            });
          }
        }
      } else if (nextEscalationLevel === 2) {
        // Escalate to manager
        escalatedTo = await EmployeeModel.findOne({
          designation: "manager",
        });
      } else if (nextEscalationLevel === 3) {
        // Escalate to director
        escalatedTo = await EmployeeModel.findOne({
          designation: "director",
        });
      }

      if (escalatedTo) {
        ticket.escalated_to = escalatedTo._id;
      }

      ticket.escalation_reason = reason;
      ticket.escalated_at = new Date();
    }

    return ticket;
  } catch (error) {
    console.error("Error escalating ticket:", error);
    return ticket;
  }
};
