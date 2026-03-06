import { useState, useEffect, useMemo } from "react";
import {
  Users,
  MessageSquare,
  Video,
  Activity,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Briefcase,
  TrendingUp,
  Calendar,
  RefreshCcw,
} from "lucide-react";
import axios from "axios";
import { BACKEND_URL } from "@/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";


export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ messagesToday: 0, activeMeetings: 0 });
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const adminToken = localStorage.getItem("token");

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadEmployees(), loadStats()]);
    setRefreshing(false);
  };

  const activeEmployeesList = employees
    .filter((employee) => employee.is_active)
    .map((employee) => ({
      id: employee._id,
      name: `${employee.user_id?.first_name} ${employee.user_id?.last_name}`,
      email: employee.user_id?.email,
      profilePic: employee.user_id?.profile_picture,
      department: employee?.department,
      position: employee?.position,
      teamLead: employee?.team_lead_id
        ? `${employee?.team_lead_id.user_id?.first_name} ${employee?.team_lead_id.user_id?.last_name}`
        : "N/A",
    }));

  // Department breakdown
  const deptBreakdown = useMemo(() => {
    const counts = {};
    employees
      .filter((e) => e.is_active)
      .forEach((e) => {
        const d = e.department?.name || "Other";
        counts[d] = (counts[d] || 0) + 1;
      });
    return Object.entries(counts)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  // Greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const adminData = useMemo(() => {
    try {
      const raw = localStorage.getItem("adminData") || localStorage.getItem("user");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadStats();
    loadUpcomingMeetings();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/employees`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setEmployees(response.data.employees || []);
    } catch (error) {
      console.error("Error loading employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setStats(res.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadUpcomingMeetings = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/meetings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const now = new Date();
      const upcoming = (res.data.data || [])
        .filter(
          (m) => m.status === "scheduled" && new Date(m.scheduled_at) > now
        )
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
        .slice(0, 5);
      setUpcomingMeetings(upcoming);
    } catch {
      // silently fail
    }
  };

  const statsData = [
    {
      label: "Total Employees",
      value: employees?.length,
      icon: Users,
      accent: "from-indigo-500 to-indigo-600",
      bg: "bg-indigo-500/10",
      iconColor: "text-indigo-400",
    },
    {
      label: "Active Users",
      value: activeEmployeesList.length,
      icon: UserCheck,
      accent: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      label: "Messages Today",
      value: stats.messagesToday,
      icon: MessageSquare,
      accent: "from-violet-500 to-violet-600",
      bg: "bg-violet-500/10",
      iconColor: "text-violet-400",
    },
    {
      label: "Active Meetings",
      value: stats.activeMeetings,
      icon: Video,
      accent: "from-amber-500 to-amber-600",
      bg: "bg-amber-500/10",
      iconColor: "text-amber-400",
    },
  ];

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 w-full">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Skeleton className="xl:col-span-2 h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 w-full space-y-8">
      {/* ─── Welcome Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting},{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              {adminData.first_name || "Admin"}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening across your organization today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCcw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsData.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card
              key={idx}
              className="bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-200 overflow-hidden group"
            >
              <CardContent className="p-5 relative">
                {/* Subtle gradient accent line */}
                <div
                  className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${stat.accent} opacity-60`}
                />
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`size-10 rounded-xl ${stat.bg} flex items-center justify-center`}
                  >
                    <Icon className={`size-[18px] ${stat.iconColor}`} />
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                    <TrendingUp className="size-3" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight tabular-nums">
                  {stat.value ?? 0}
                </p>
                <p className="text-xs text-zinc-500 mt-1 font-medium">
                  {stat.label}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── Main Panels ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Employees - 2 cols */}
        <Card className="xl:col-span-2 bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="size-4 text-indigo-400" />
              Team Members
            </CardTitle>
            <Badge
              variant="secondary"
              className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
            >
              {activeEmployeesList.length} active
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {employees
                .filter((employee) => employee.is_active)
                .slice(0, 6)
                .map((employee) => {
                  const fullName = `${employee.user_id?.first_name} ${employee.user_id?.last_name}`;
                  const initials = fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("");
                  const deptName = employee.department?.name || "—";
                  const deptColor = employee.department?.color || "#71717a";
                  return (
                    <div
                      key={employee._id}
                      className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 ring-2 ring-zinc-800">
                          <AvatarImage
                            src={employee.user_id?.profile_picture}
                          />
                          <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400 font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">
                            {fullName}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {employee.user_id?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] border font-medium"
                          style={{ borderColor: `${deptColor}33`, color: deptColor }}
                        >
                          {deptName}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/20 text-emerald-400"
                        >
                          {employee.position}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              {employees.filter((e) => e.is_active).length === 0 && (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No active employees found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Department Breakdown */}
          <Card className="bg-zinc-900/80 border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Briefcase className="size-4 text-violet-400" />
                Departments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deptBreakdown.map(({ dept, count }) => {
                  const pct = employees.length
                    ? Math.round(
                        (count / employees.filter((e) => e.is_active).length) *
                          100
                      )
                    : 0;
                  return (
                    <div key={dept}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-zinc-300">
                          {dept}
                        </span>
                        <span className="text-xs text-zinc-500 tabular-nums">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {deptBreakdown.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-8">
                    No departments
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-zinc-900/80 border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="size-4 text-emerald-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeEmployeesList.slice(0, 4).map((emp) => (
                  <div key={emp.id} className="flex items-start gap-3">
                    <div className="size-7 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-indigo-500/10">
                      <Activity className="size-3 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-400">
                        <span className="font-medium text-zinc-200">
                          {emp.name}
                        </span>{" "}
                        joined{" "}
                        <span className="text-zinc-300 capitalize">
                          {emp.department?.name || "—"}
                        </span>
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5 capitalize">
                        {emp.position}
                      </p>
                    </div>
                  </div>
                ))}
                {activeEmployeesList.length === 0 && (
                  <div className="py-10 text-center text-sm text-zinc-500">
                    No recent activity
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Meetings */}
          <Card className="bg-zinc-900/80 border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-violet-400" />
                Upcoming Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingMeetings.length === 0 ? (
                <div className="text-center py-8">
                  <Video className="size-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No upcoming meetings</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingMeetings.map((m) => {
                    const d = new Date(m.scheduled_at);
                    const hostName = m.host_id?.first_name
                      ? `${m.host_id.first_name} ${m.host_id.last_name || ""}`.trim()
                      : "Unknown";
                    return (
                      <div
                        key={m._id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/30 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                          <Video className="size-4 text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">
                            {m.title}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {d.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            at{" "}
                            {d.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {m.duration_minutes
                              ? ` · ${m.duration_minutes}min`
                              : ""}
                          </p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            Host: {hostName}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/20 text-emerald-400 flex-shrink-0"
                        >
                          Upcoming
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
