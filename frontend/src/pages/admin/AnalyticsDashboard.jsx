import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Users,
  MessageSquare,
  Video,
  UserCheck,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Building,
  Cake,
  CalendarOff,
  CalendarCheck,
  UserPlus,
  CalendarDays,
  PieChart as PieChartIcon,
  RefreshCcw,
  PartyPopper,
  Briefcase,
  Home,
  Monitor,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BACKEND_URL } from "@/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#7c3aed", "#4f46e5"];
const STATUS_COLORS = { scheduled: "#6366f1", active: "#22c55e", ended: "#a1a1aa", cancelled: "#ef4444" };
const LEAVE_TYPE_COLORS = { paid: "#6366f1", floater: "#8b5cf6", marriage: "#ec4899", unpaid: "#f97316" };

const POSITION_LABELS = {
  ceo: "CEO", cto: "CTO", project_manager: "Project Manager", team_lead: "Team Lead",
  senior_engineer: "Senior Engineer", engineer: "Engineer", junior_engineer: "Junior Engineer", intern: "Intern",
};

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [messageActivity, setMessageActivity] = useState([]);
  const [meetingStats, setMeetingStats] = useState(null);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [birthdays, setBirthdays] = useState({ today: [], thisWeek: [], thisMonth: [] });
  const [onLeave, setOnLeave] = useState({ departments: [], totalOnLeave: 0 });
  const [newJoiners, setNewJoiners] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaveDistribution, setLeaveDistribution] = useState({ distribution: [], monthlyTrend: [] });
  const [timeRange, setTimeRange] = useState("7");
  const [birthdayTab, setBirthdayTab] = useState("thisWeek");

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [overviewRes, msgRes, meetRes, deptRes, bdayRes, leaveRes, joinRes, holRes, lDistRes] =
          await Promise.all([
            axios.get(`${BACKEND_URL}/analytics/overview`, { headers }),
            axios.get(`${BACKEND_URL}/analytics/messages?days=${timeRange}`, { headers }),
            axios.get(`${BACKEND_URL}/analytics/meetings?days=${timeRange}`, { headers }),
            axios.get(`${BACKEND_URL}/analytics/departments`, { headers }),
            axios.get(`${BACKEND_URL}/analytics/birthdays`, { headers }),
            axios.get(`${BACKEND_URL}/analytics/on-leave-today`, { headers }),
            axios.get(`${BACKEND_URL}/analytics/new-joiners?days=90`, { headers }),
            axios.get(`${BACKEND_URL}/analytics/upcoming-holidays?limit=8`, { headers }),
            axios.get(`${BACKEND_URL}/analytics/leave-distribution`, { headers }),
          ]);

        setOverview(overviewRes.data);
        setMessageActivity(msgRes.data.data || []);
        setMeetingStats(meetRes.data);
        setDepartmentStats(deptRes.data.departments || []);
        setBirthdays(bdayRes.data || { today: [], thisWeek: [], thisMonth: [] });
        setOnLeave(leaveRes.data || { departments: [], totalOnLeave: 0 });
        setNewJoiners(joinRes.data.joiners || []);
        setHolidays(holRes.data.holidays || []);
        setLeaveDistribution(lDistRes.data || { distribution: [], monthlyTrend: [] });
      } catch (err) {
        console.error("Analytics fetch error:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeRange]
  );

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 w-full space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-7 w-52 mb-2" /><Skeleton className="h-4 w-80" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const birthdayList = birthdays[birthdayTab] || [];

  return (
    <div className="p-6 lg:p-8 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-5 text-indigo-500" />
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Workforce insights, birthdays, and department overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={timeRange} onValueChange={setTimeRange} className="h-9">
            <TabsList className="h-8">
              <TabsTrigger value="7" className="text-xs px-3 h-7">7d</TabsTrigger>
              <TabsTrigger value="14" className="text-xs px-3 h-7">14d</TabsTrigger>
              <TabsTrigger value="30" className="text-xs px-3 h-7">30d</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => fetchAll(true)} disabled={refreshing} className="h-8">
            <RefreshCcw className={`size-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Total Employees"
          value={overview?.activeEmployees ?? 0}
          sub={`${overview?.totalEmployees ?? 0} total | ${overview?.activeUsersToday ?? 0} online today`}
        />
        <KPICard
          icon={CalendarOff}
          label="On Leave Today"
          value={overview?.onLeaveToday ?? 0}
          sub={`From ${onLeave?.totalOnLeave ?? 0} departments`}
        />
        <KPICard
          icon={Cake}
          label="Birthdays This Month"
          value={birthdays.thisMonth?.length ?? 0}
          sub={`${birthdays.today?.length ?? 0} celebrating today`}
          highlight={birthdays.today?.length > 0}
        />
      </div>

      {/* Birthdays + On Leave Today */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Birthdays */}
        <Card className="bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cake className="size-4 text-pink-400" />
                Birthdays
              </CardTitle>
              <Tabs value={birthdayTab} onValueChange={setBirthdayTab}>
                <TabsList className="h-7">
                  <TabsTrigger value="today" className="text-[10px] px-2 h-6">
                    Today {birthdays.today?.length > 0 && <span className="ml-1 text-pink-400">({birthdays.today.length})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="thisWeek" className="text-[10px] px-2 h-6">This Week</TabsTrigger>
                  <TabsTrigger value="thisMonth" className="text-[10px] px-2 h-6">This Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 max-h-72 overflow-y-auto">
              {birthdayList.length === 0 ? (
                <div className="py-10 text-center">
                  <PartyPopper className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No birthdays {birthdayTab === "today" ? "today" : birthdayTab === "thisWeek" ? "this week" : "this month"}
                  </p>
                </div>
              ) : (
                birthdayList.map((p) => {
                  const dob = new Date(p.date_of_birth);
                  const dobStr = dob.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const isToday = birthdays.today?.some((t) => t._id === p._id);
                  return (
                    <div key={p._id} className={`flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors ${isToday ? "bg-pink-500/10 border border-pink-500/20" : "hover:bg-muted/30"}`}>
                      <Avatar className="size-8">
                        <AvatarImage src={p.profile_picture} />
                        <AvatarFallback className="text-[10px]">{p.first_name?.[0]}{p.last_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.first_name} {p.last_name}
                          {isToday && <span className="ml-2 text-xs">&#127874;</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {p.department?.name || "\u2014"} · {POSITION_LABELS[p.position] || p.position || "\u2014"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{dobStr}</p>
                        {p.age && <p className="text-[10px] text-muted-foreground">Turns {p.age}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* On Leave Today */}
        <Card className="bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarOff className="size-4 text-orange-400" />
              On Leave Today
              <Badge variant="secondary" className="text-[10px] ml-auto">{onLeave.totalOnLeave} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {onLeave.departments.length === 0 ? (
                <div className="py-10 text-center">
                  <UserCheck className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No one is on leave today</p>
                </div>
              ) : (
                onLeave.departments.map((dept) => (
                  <div key={dept.department}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="size-2 rounded-full" style={{ backgroundColor: dept.color }} />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{dept.department}</p>
                      <span className="text-[10px] text-muted-foreground">({dept.employees.length})</span>
                    </div>
                    {dept.employees.map((emp, idx) => (
                      <div key={emp._id + "-" + idx} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <Avatar className="size-7">
                          <AvatarImage src={emp.profile_picture} />
                          <AvatarFallback className="text-[9px]">{emp.first_name?.[0]}{emp.last_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{emp.first_name} {emp.last_name}</p>
                          <p className="text-[10px] text-muted-foreground">{POSITION_LABELS[emp.position] || emp.position || ""}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: LEAVE_TYPE_COLORS[emp.leave_type] || "#6366f1", color: LEAVE_TYPE_COLORS[emp.leave_type] || "#a1a1aa" }}>
                          {emp.leave_type} | {emp.days_count}d
                        </Badge>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Leave Trends */}
        <Card className="xl:col-span-2 bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChartIcon className="size-4 text-violet-400" />
              Leave Trends ({new Date().getFullYear()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaveDistribution.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#52525b" fontSize={11} />
                  <YAxis stroke="#52525b" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="leaves" name="Leave Requests" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="days" name="Total Days" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {leaveDistribution.distribution.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-zinc-800/50">
                {leaveDistribution.distribution.map((d) => (
                  <div key={d.type} className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full" style={{ backgroundColor: LEAVE_TYPE_COLORS[d.type] || "#6366f1" }} />
                    <span className="text-xs text-muted-foreground capitalize">{d.type}:</span>
                    <span className="text-xs font-medium">{d.totalDays}d ({d.count})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Message Activity + Meeting Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="size-4 text-indigo-400" />
              Message Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={messageActivity}>
                  <defs>
                    <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="#52525b" fontSize={11} />
                  <YAxis stroke="#52525b" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="messages" stroke="#6366f1" strokeWidth={2} fill="url(#msgGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="size-4 text-violet-400" />
              Meeting Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(meetingStats?.byStatus || []).map((s) => ({ name: s.status, value: s.count }))}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value"
                  >
                    {(meetingStats?.byStatus || []).map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status] || COLORS[i]} />)}
                  </Pie>
                  <Legend formatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)} wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Performance */}
      <Card className="bg-zinc-900/80 border-zinc-800/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building className="size-4 text-cyan-400" />
            Department Overview
            <Badge variant="secondary" className="text-[10px] ml-auto">This week</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentStats} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="department" stroke="#52525b" fontSize={11} />
                <YAxis stroke="#52525b" fontSize={11} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="employees" name="Employees" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="messagesThisWeek" name="Messages" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="meetingsThisWeek" name="Meetings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* New Joiners + Upcoming Holidays */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* New Joiners */}
        <Card className="bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="size-4 text-emerald-400" />
              New Joiners
              <Badge variant="secondary" className="text-[10px] ml-auto">Last 90 days</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 max-h-64 overflow-y-auto">
              {newJoiners.length === 0 ? (
                <div className="py-10 text-center">
                  <UserPlus className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No new joiners in the last 90 days</p>
                </div>
              ) : (
                newJoiners.map((emp) => (
                  <div key={emp._id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <Avatar className="size-8">
                      <AvatarImage src={emp.profile_picture} />
                      <AvatarFallback className="text-[10px]">{emp.first_name?.[0]}{emp.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.first_name} {emp.last_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {emp.department?.name || "\u2014"} · {POSITION_LABELS[emp.position] || emp.position || "\u2014"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(emp.hire_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Holidays */}
        <Card className="bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="size-4 text-amber-400" />
              Upcoming Holidays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 max-h-64 overflow-y-auto">
              {holidays.length === 0 ? (
                <div className="py-10 text-center">
                  <CalendarDays className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming holidays</p>
                </div>
              ) : (
                holidays.map((h) => {
                  const hDate = new Date(h.date);
                  const dayName = hDate.toLocaleDateString("en-US", { weekday: "short" });
                  const daysUntil = Math.ceil((hDate - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={h._id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="size-10 rounded-lg bg-amber-500/10 flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold text-amber-400 uppercase">{hDate.toLocaleDateString("en-US", { month: "short" })}</span>
                        <span className="text-sm font-bold text-amber-300 -mt-0.5">{hDate.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{h.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {dayName} · <span className="capitalize">{h.type || "holiday"}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil}d`}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meeting Activity + Types */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="size-4 text-violet-400" />
              Meeting Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meetingStats?.dailyData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="#52525b" fontSize={11} />
                  <YAxis stroke="#52525b" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="meetings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="size-4 text-cyan-400" />
              Meeting Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(meetingStats?.byType || []).map((t) => ({ name: t.type?.replace("_", " ") || "Unknown", value: t.count }))}
                    cx="50%" cy="50%" outerRadius={75} paddingAngle={4} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(meetingStats?.byType || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({ icon: Icon, label, value, change, sub, highlight }) {
  return (
    <Card className={`bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-200 overflow-hidden ${highlight ? "ring-1 ring-pink-500/30" : ""}`}>
      <CardContent className="p-5 relative">
        <div className="flex items-center justify-between mb-4">
          <div className={`size-10 rounded-xl flex items-center justify-center ${highlight ? "bg-pink-500/10" : "bg-indigo-500/10"}`}>
            <Icon className={`size-[18px] ${highlight ? "text-pink-400" : "text-indigo-400"}`} />
          </div>
          {change !== undefined && change !== null && (
            <Badge variant={change >= 0 ? "default" : "destructive"} className="text-[10px] gap-0.5">
              {change >= 0 ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
              {change >= 0 ? "+" : ""}{change}%
            </Badge>
          )}
        </div>
        <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        <p className="text-xs text-zinc-500 mt-1 font-medium">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
