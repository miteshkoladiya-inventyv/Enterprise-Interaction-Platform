import LeaveRequest from "../../models/LeaveRequest.js";
import LeaveBalance from "../../models/LeaveBalance.js";
import Employee from "../../models/Employee.js";

// Default leave allocation per year
// 21 Paid Leaves + 2 Floater Leaves + 15 Marriage Leaves + Indian National Holidays
const DEFAULT_LEAVE_ALLOCATION = {
  paid: 21,
  floater: 2,
  marriage: 15,
  unpaid: 0,
};

// ─── Helpers ───────────────────────────────────────────
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// The valid leave types in the current system
const VALID_LEAVE_TYPES = new Set(Object.keys(DEFAULT_LEAVE_ALLOCATION));

// Ensure leave balance exists for a user for current year.
// Also migrates away from old leave types (sick, casual, earned, etc.)
async function ensureLeaveBalance(userId) {
  const year = new Date().getFullYear();
  const existing = await LeaveBalance.find({ employee_id: userId, year });

  if (existing.length === 0) {
    // No records at all — create fresh
    const entries = Object.entries(DEFAULT_LEAVE_ALLOCATION).map(
      ([leave_type, allocated]) => ({
        employee_id: userId,
        year,
        leave_type,
        allocated,
        used: 0,
        carried_forward: 0,
      })
    );
    await LeaveBalance.insertMany(entries);
    return LeaveBalance.find({ employee_id: userId, year });
  }

  // Remove any obsolete leave type records
  const hasOld = existing.some((b) => !VALID_LEAVE_TYPES.has(b.leave_type));
  if (hasOld) {
    await LeaveBalance.deleteMany({
      employee_id: userId,
      year,
      leave_type: { $nin: [...VALID_LEAVE_TYPES] },
    });
  }

  // Check which valid types already exist and create any missing ones
  const existingTypes = new Set(
    existing.filter((b) => VALID_LEAVE_TYPES.has(b.leave_type)).map((b) => b.leave_type)
  );
  const missing = Object.entries(DEFAULT_LEAVE_ALLOCATION).filter(
    ([type]) => !existingTypes.has(type)
  );
  if (missing.length > 0) {
    await LeaveBalance.insertMany(
      missing.map(([leave_type, allocated]) => ({
        employee_id: userId,
        year,
        leave_type,
        allocated,
        used: 0,
        carried_forward: 0,
      }))
    );
  }

  if (hasOld || missing.length > 0) {
    return LeaveBalance.find({ employee_id: userId, year });
  }

  return existing;
}

// ─── 1. Get My Leave Balances ──────────────────────────
export const getMyLeaveBalance = async (req, res) => {
  try {
    const balances = await ensureLeaveBalance(req.userId);
    res.json({ balances });
  } catch (error) {
    console.error("Get leave balance error:", error);
    res.status(500).json({ error: "Failed to fetch leave balance" });
  }
};

// ─── 2. Request Leave ──────────────────────────────────
export const requestLeave = async (req, res) => {
  try {
    const { leave_type, start_date, end_date, days_count, reason } = req.body;

    if (!leave_type || !start_date || !end_date || !reason) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const computedDays = days_count || Math.ceil(
      (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24) + 1
    );

    // Check balance (skip for unpaid)
    if (leave_type !== "unpaid") {
      const balances = await ensureLeaveBalance(req.userId);
      const balance = balances.find((b) => b.leave_type === leave_type);
      if (balance) {
        const remaining = balance.allocated + balance.carried_forward - balance.used;
        if (computedDays > remaining) {
          return res.status(400).json({
            error: `Insufficient ${leave_type} leave balance. Remaining: ${remaining} days`,
          });
        }
      }
    }

    // Check for overlapping approved/pending leaves
    const overlap = await LeaveRequest.findOne({
      employee_id: req.userId,
      status: { $in: ["pending", "approved"] },
      $or: [
        { start_date: { $lte: new Date(end_date) }, end_date: { $gte: new Date(start_date) } },
      ],
    });

    if (overlap) {
      return res.status(400).json({
        error: "You already have a leave request overlapping with these dates",
      });
    }

    const leaveRequest = await LeaveRequest.create({
      employee_id: req.userId,
      leave_type,
      start_date: startOfDay(new Date(start_date)),
      end_date: startOfDay(new Date(end_date)),
      days_count: computedDays,
      reason,
    });

    res.status(201).json({ success: true, leaveRequest });
  } catch (error) {
    console.error("Request leave error:", error);
    res.status(500).json({ error: "Failed to request leave" });
  }
};

// ─── 3. Cancel My Leave ────────────────────────────────
export const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await LeaveRequest.findOne({
      _id: id,
      employee_id: req.userId,
    });

    if (!leave) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({ error: "Can only cancel pending requests" });
    }

    leave.status = "cancelled";
    await leave.save();

    res.json({ success: true, leaveRequest: leave });
  } catch (error) {
    console.error("Cancel leave error:", error);
    res.status(500).json({ error: "Failed to cancel leave" });
  }
};

// ─── 4. Get My Leave Requests ──────────────────────────
export const getMyLeaveRequests = async (req, res) => {
  try {
    const { status, year } = req.query;
    const filter = { employee_id: req.userId };

    if (status && status !== "all") filter.status = status;

    if (year) {
      const y = parseInt(year);
      filter.start_date = {
        $gte: new Date(y, 0, 1),
        $lte: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    }

    const requests = await LeaveRequest.find(filter)
      .populate("approved_by", "first_name last_name")
      .sort({ created_at: -1 });

    res.json({ requests });
  } catch (error) {
    console.error("Get my leaves error:", error);
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
};

// ─── 5. Admin: Get All Leave Requests ──────────────────
export const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, department } = req.query;
    const filter = {};

    if (status && status !== "all") filter.status = status;

    // Department filter
    let empUserIds = null;
    if (department && department !== "all") {
      const emps = await Employee.find({ department, is_active: true }).select("user_id");
      empUserIds = emps.map((e) => e.user_id);
      filter.employee_id = { $in: empUserIds };
    }

    const requests = await LeaveRequest.find(filter)
      .populate("employee_id", "first_name last_name email profile_picture")
      .populate("approved_by", "first_name last_name")
      .sort({ created_at: -1 });

    // Stats
    const pending = requests.filter((r) => r.status === "pending").length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const rejected = requests.filter((r) => r.status === "rejected").length;

    res.json({ requests, stats: { pending, approved, rejected, total: requests.length } });
  } catch (error) {
    console.error("Get all leaves error:", error);
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
};

// ─── 6. Admin: Approve / Reject Leave ──────────────────
export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_remarks } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be approved or rejected" });
    }

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    if (leave.status !== "pending") {
      return res.status(400).json({ error: "Can only update pending requests" });
    }

    leave.status = status;
    leave.approved_by = req.userId;
    leave.approved_at = new Date();
    leave.admin_remarks = admin_remarks || "";
    await leave.save();

    // If approved, deduct from balance
    if (status === "approved") {
      const year = leave.start_date.getFullYear();
      await LeaveBalance.findOneAndUpdate(
        { employee_id: leave.employee_id, year, leave_type: leave.leave_type },
        { $inc: { used: leave.days_count } }
      );
    }

    const updated = await LeaveRequest.findById(id)
      .populate("employee_id", "first_name last_name email profile_picture")
      .populate("approved_by", "first_name last_name");

    res.json({ success: true, leaveRequest: updated });
  } catch (error) {
    console.error("Update leave status error:", error);
    res.status(500).json({ error: "Failed to update leave status" });
  }
};

// ─── 7. Admin: Get All Leave Balances ──────────────────
export const getAllLeaveBalances = async (req, res) => {
  try {
    const { year } = req.query;
    const y = parseInt(year) || new Date().getFullYear();

    // Get all active employees
    const employees = await Employee.find({ is_active: true })
      .populate("user_id", "first_name last_name email profile_picture")
      .select("user_id department position");

    // Ensure all employees have balances
    for (const emp of employees) {
      await ensureLeaveBalance(emp.user_id._id);
    }

    const balances = await LeaveBalance.find({ year: y })
      .populate("employee_id", "first_name last_name email profile_picture");

    // Group by employee
    const grouped = {};
    balances.forEach((b) => {
      const key = b.employee_id?._id?.toString();
      if (!key) return;
      if (!grouped[key]) {
        grouped[key] = {
          employee: b.employee_id,
          department: employees.find((e) => e.user_id._id.toString() === key)?.department,
          balances: {},
        };
      }
      grouped[key].balances[b.leave_type] = {
        allocated: b.allocated,
        used: b.used,
        carried_forward: b.carried_forward,
        remaining: b.remaining,
      };
    });

    res.json({ employees: Object.values(grouped), year: y });
  } catch (error) {
    console.error("Get all leave balances error:", error);
    res.status(500).json({ error: "Failed to fetch leave balances" });
  }
};

// ─── 8. Admin: Update Leave Balance ────────────────────
export const updateLeaveBalance = async (req, res) => {
  try {
    const { employee_id, leave_type, allocated, carried_forward } = req.body;
    const year = new Date().getFullYear();

    const balance = await LeaveBalance.findOneAndUpdate(
      { employee_id, year, leave_type },
      { allocated, carried_forward },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, balance });
  } catch (error) {
    console.error("Update leave balance error:", error);
    res.status(500).json({ error: "Failed to update leave balance" });
  }
};
