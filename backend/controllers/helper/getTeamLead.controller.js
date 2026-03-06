import Employee from "../../models/Employee.js";

export async function getTeamLead(req, res) {
  try {
    const teamLeads = await Employee.find({
      position: { $in: ["ceo", "cto", "project_manager", "team_lead"] },
    })
      .populate("user_id", "email first_name last_name")
      .populate("department")
      .populate("team_lead_id");

    return res.status(200).json({
      success: true,
      data: teamLeads,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch team leads",
      error: error.message,
    });
  }
}
