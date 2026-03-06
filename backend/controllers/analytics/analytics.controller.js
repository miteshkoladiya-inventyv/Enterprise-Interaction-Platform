import User from "../../models/User.js";
import Employee from "../../models/Employee.js";
import Meeting from "../../models/Meeting.js";
import { Message } from "../../models/Message.js";
import { ChatChannel } from "../../models/ChatChannel.js";
import LeaveRequest from "../../models/LeaveRequest.js";
import Holiday from "../../models/Holiday.js";

// ─── Helpers ────────────────────────────────────────────────
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

// ─── 1. Overview KPI cards ──────────────────────────────────
export const getOverviewStats = async (req, res) => {
  try {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const weekAgo = daysAgo(7);
    const prevWeekStart = daysAgo(14);

    const [
      totalEmployees,
      activeEmployees,
      activeUsersToday,
      messagesToday,
      messagesThisWeek,
      messagesPrevWeek,
      activeMeetings,
      meetingsThisWeek,
      meetingsPrevWeek,
      totalChannels,
      onLeaveToday,
    ] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ is_active: true }),
      User.countDocuments({ last_login: { $gte: today }, status: "active" }),
      Message.countDocuments({ created_at: { $gte: today }, deleted_at: null }),
      Message.countDocuments({ created_at: { $gte: weekAgo }, deleted_at: null }),
      Message.countDocuments({ created_at: { $gte: prevWeekStart, $lt: weekAgo }, deleted_at: null }),
      Meeting.countDocuments({ status: "active" }),
      Meeting.countDocuments({ createdAt: { $gte: weekAgo } }),
      Meeting.countDocuments({ createdAt: { $gte: prevWeekStart, $lt: weekAgo } }),
      ChatChannel.countDocuments(),
      LeaveRequest.countDocuments({
        status: "approved",
        start_date: { $lte: todayEnd },
        end_date: { $gte: today },
      }),
    ]);

    const msgChange =
      messagesPrevWeek > 0
        ? Math.round(((messagesThisWeek - messagesPrevWeek) / messagesPrevWeek) * 100)
        : messagesThisWeek > 0 ? 100 : 0;

    const meetChange =
      meetingsPrevWeek > 0
        ? Math.round(((meetingsThisWeek - meetingsPrevWeek) / meetingsPrevWeek) * 100)
        : meetingsThisWeek > 0 ? 100 : 0;

    res.json({
      totalEmployees,
      activeEmployees,
      activeUsersToday,
      messagesToday,
      messagesThisWeek,
      messagesWeekChange: msgChange,
      activeMeetings,
      meetingsThisWeek,
      meetingsWeekChange: meetChange,
      totalChannels,
      onLeaveToday,
    });
  } catch (error) {
    console.error("Overview stats error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 2. Message activity ────────────────────────────────────
export const getMessageActivity = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = daysAgo(days);

    const data = await Message.aggregate([
      { $match: { created_at: { $gte: since }, deleted_at: null } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = data.find((r) => r._id === key);
      result.push({ date: key, messages: found ? found.count : 0 });
    }
    res.json({ data: result });
  } catch (error) {
    console.error("Message activity error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 3. Meeting usage stats ─────────────────────────────────
export const getMeetingStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = daysAgo(days);

    const perDay = await Meeting.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailyData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = perDay.find((r) => r._id === key);
      dailyData.push({ date: key, meetings: found ? found.count : 0 });
    }

    const durationAgg = await Meeting.aggregate([
      {
        $match: {
          started_at: { $exists: true, $ne: null },
          ended_at: { $exists: true, $ne: null },
        },
      },
      { $project: { duration: { $subtract: ["$ended_at", "$started_at"] } } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: "$duration" },
          totalMeetings: { $sum: 1 },
        },
      },
    ]);

    const avgDurationMinutes =
      durationAgg.length > 0 ? Math.round(durationAgg[0].avgDuration / 60000) : 0;
    const totalEndedMeetings =
      durationAgg.length > 0 ? durationAgg[0].totalMeetings : 0;

    const byType = await Meeting.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$meeting_type", count: { $sum: 1 } } },
    ]);

    const byStatus = await Meeting.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.json({
      dailyData,
      avgDurationMinutes,
      totalEndedMeetings,
      byType: byType.map((t) => ({ type: t._id, count: t.count })),
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    });
  } catch (error) {
    console.error("Meeting stats error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 4. Department-wise performance ─────────────────────────
export const getDepartmentStats = async (req, res) => {
  try {
    const deptCounts = await Employee.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
      { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
      { $sort: { count: -1 } },
    ]);

    const weekAgo = daysAgo(7);
    const departments = await Employee.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: "$department", userIds: { $push: "$user_id" } } },
    ]);

    const deptMessageCounts = await Promise.all(
      departments.map(async (dept) => {
        const msgCount = await Message.countDocuments({
          sender_id: { $in: dept.userIds },
          created_at: { $gte: weekAgo },
          deleted_at: null,
        });
        return { department: dept._id, messages: msgCount };
      })
    );

    const deptMeetingCounts = await Promise.all(
      departments.map(async (dept) => {
        const meetCount = await Meeting.countDocuments({
          host_id: { $in: dept.userIds },
          createdAt: { $gte: weekAgo },
        });
        return { department: dept._id, meetings: meetCount };
      })
    );

    const combined = deptCounts.map((d) => {
      const msgData = deptMessageCounts.find((m) => String(m.department) === String(d._id)) || { messages: 0 };
      const meetData = deptMeetingCounts.find((m) => String(m.department) === String(d._id)) || { meetings: 0 };
      return {
        department: d.dept?.name || String(d._id),
        departmentColor: d.dept?.color || "#6366f1",
        employees: d.count,
        messagesThisWeek: msgData.messages,
        meetingsThisWeek: meetData.meetings,
      };
    });

    res.json({ departments: combined });
  } catch (error) {
    console.error("Department stats error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 5. Birthdays ───────────────────────────────────────────
export const getBirthdays = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const employees = await Employee.find({ is_active: true })
      .populate("user_id", "first_name last_name email profile_picture date_of_birth")
      .populate("department", "name color")
      .lean();

    const withDob = employees.filter((e) => e.user_id?.date_of_birth);

    const today = [];
    const thisWeek = [];
    const thisMonth = [];

    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStartDay = currentDay + mondayOffset;
    const weekEndDay = weekStartDay + 6;

    for (const emp of withDob) {
      const dob = new Date(emp.user_id.date_of_birth);
      const dobMonth = dob.getMonth() + 1;
      const dobDay = dob.getDate();
      const age = now.getFullYear() - dob.getFullYear();

      const person = {
        _id: emp._id,
        user_id: emp.user_id._id,
        first_name: emp.user_id.first_name,
        last_name: emp.user_id.last_name,
        email: emp.user_id.email,
        profile_picture: emp.user_id.profile_picture,
        date_of_birth: emp.user_id.date_of_birth,
        department: emp.department,
        position: emp.position,
        age,
        birthdayDate: String(dobMonth).padStart(2, "0") + "-" + String(dobDay).padStart(2, "0"),
      };

      if (dobMonth === currentMonth) {
        thisMonth.push(person);
        if (dobDay === currentDay) today.push(person);
        if (dobDay >= weekStartDay && dobDay <= weekEndDay) thisWeek.push(person);
      }
    }

    const sortByDay = (a, b) => new Date(a.date_of_birth).getDate() - new Date(b.date_of_birth).getDate();
    today.sort(sortByDay);
    thisWeek.sort(sortByDay);
    thisMonth.sort(sortByDay);

    res.json({ today, thisWeek, thisMonth });
  } catch (error) {
    console.error("Birthdays error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 6. On leave today ─────────────────────────────────────
export const getOnLeaveToday = async (req, res) => {
  try {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const leaveRequests = await LeaveRequest.find({
      status: "approved",
      start_date: { $lte: todayEnd },
      end_date: { $gte: today },
    })
      .populate("employee_id", "first_name last_name email profile_picture")
      .lean();

    const employeeUserIds = leaveRequests.map((lr) => lr.employee_id?._id);
    const employees = await Employee.find({
      user_id: { $in: employeeUserIds },
      is_active: true,
    })
      .populate("department", "name color")
      .lean();

    const empMap = {};
    employees.forEach((e) => { empMap[e.user_id.toString()] = e; });

    const byDepartment = {};
    for (const lr of leaveRequests) {
      if (!lr.employee_id) continue;
      const uid = lr.employee_id._id.toString();
      const emp = empMap[uid];
      const deptName = emp?.department?.name || "Unassigned";
      const deptColor = emp?.department?.color || "#6366f1";

      if (!byDepartment[deptName]) {
        byDepartment[deptName] = { department: deptName, color: deptColor, employees: [] };
      }

      byDepartment[deptName].employees.push({
        _id: lr.employee_id._id,
        first_name: lr.employee_id.first_name,
        last_name: lr.employee_id.last_name,
        email: lr.employee_id.email,
        profile_picture: lr.employee_id.profile_picture,
        leave_type: lr.leave_type,
        start_date: lr.start_date,
        end_date: lr.end_date,
        days_count: lr.days_count,
        position: emp?.position || "",
      });
    }

    const departments = Object.values(byDepartment).sort((a, b) => b.employees.length - a.employees.length);
    res.json({ departments, totalOnLeave: leaveRequests.length });
  } catch (error) {
    console.error("On leave today error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 7. New joiners ────────────────────────────────────────
export const getNewJoiners = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const since = daysAgo(days);

    const newEmployees = await Employee.find({
      hire_date: { $gte: since },
      is_active: true,
    })
      .populate("user_id", "first_name last_name email profile_picture")
      .populate("department", "name color")
      .sort({ hire_date: -1 })
      .lean();

    const joiners = newEmployees.map((emp) => ({
      _id: emp._id,
      first_name: emp.user_id?.first_name,
      last_name: emp.user_id?.last_name,
      email: emp.user_id?.email,
      profile_picture: emp.user_id?.profile_picture,
      department: emp.department,
      position: emp.position,
      hire_date: emp.hire_date,
    }));

    res.json({ joiners, total: joiners.length });
  } catch (error) {
    console.error("New joiners error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 9. Upcoming holidays ──────────────────────────────────
export const getUpcomingHolidays = async (req, res) => {
  try {
    const today = startOfDay(new Date());
    const limit = parseInt(req.query.limit) || 10;

    const holidays = await Holiday.find({ date: { $gte: today } })
      .sort({ date: 1 })
      .limit(limit)
      .lean();

    res.json({ holidays });
  } catch (error) {
    console.error("Upcoming holidays error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── 10. Leave distribution ─────────────────────────────────
export const getLeaveDistribution = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const distribution = await LeaveRequest.aggregate([
      {
        $match: {
          status: { $in: ["approved", "pending"] },
          start_date: { $gte: new Date(year + "-01-01"), $lte: new Date(year + "-12-31") },
        },
      },
      { $group: { _id: "$leave_type", count: { $sum: 1 }, totalDays: { $sum: "$days_count" } } },
      { $sort: { totalDays: -1 } },
    ]);

    const monthlyTrend = await LeaveRequest.aggregate([
      {
        $match: {
          status: "approved",
          start_date: { $gte: new Date(year + "-01-01"), $lte: new Date(year + "-12-31") },
        },
      },
      { $group: { _id: { $month: "$start_date" }, count: { $sum: 1 }, totalDays: { $sum: "$days_count" } } },
      { $sort: { _id: 1 } },
    ]);

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyData = monthNames.map((name, idx) => {
      const found = monthlyTrend.find((m) => m._id === idx + 1);
      return { month: name, leaves: found ? found.count : 0, days: found ? found.totalDays : 0 };
    });

    res.json({
      distribution: distribution.map((d) => ({ type: d._id, count: d.count, totalDays: d.totalDays })),
      monthlyTrend: monthlyData,
    });
  } catch (error) {
    console.error("Leave distribution error:", error);
    res.status(500).json({ error: error.message });
  }
};
