import { useState, useEffect, useMemo } from "react";
import {
  Users,
  MessageSquare,
  Video,
  UserCheck,
  Clock,
  Briefcase,
  RefreshCcw,
  Ticket,
  ShieldCheck,
  Globe2,
  UserPlus,
} from "lucide-react";
import axios from "axios";
import { BACKEND_URL } from "@/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";


export default function Dashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ messagesToday: 0, activeMeetings: 0 });
  const [ticketStats, setTicketStats] = useState({
    total_tickets: 0,
    by_status: {},
    by_priority: {},
    sla_breaches: 0,
  });
  const adminToken = localStorage.getItem("token");

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadEmployees(),
      loadStats(),
      loadTicketStats(),
    ]);
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
    loadTicketStats();
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

  const loadTicketStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/tickets/stats/sla`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setTicketStats(res.data || {});
    } catch (error) {
      console.error("Error loading ticket stats:", error);
    }
  };

  const recentHires = useMemo(() => {
    return [...employees]
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.hire_date || 0) -
          new Date(a.createdAt || a.hire_date || 0)
      )
      .slice(0, 4);
  }, [employees]);

  const quickActions = [
    {
      label: "Create Employee",
      hint: "Add a new team member",
      icon: UserPlus,
      onClick: () => onNavigate?.("employees"),
    },
    {
      label: "Review Tickets",
      hint: "Check open support work",
      icon: Ticket,
      onClick: () => onNavigate?.("tickets"),
    },
    {
      label: "Manage Roles",
      hint: "Update access quickly",
      icon: ShieldCheck,
      onClick: () => onNavigate?.("roles"),
    },
    {
      label: "Open Global Work",
      hint: "See timezone overlap",
      icon: Globe2,
      onClick: () => onNavigate?.("global-collab"),
    },
  ];

  const ticketOverview = [
    {
      label: "Open",
      value:
        (ticketStats.by_status?.open || 0) +
        (ticketStats.by_status?.pending || 0) +
        (ticketStats.by_status?.in_progress || 0),
      tone: "text-amber-400",
    },
    {
      label: "Critical",
      value: ticketStats.by_priority?.critical || 0,
      tone: "text-red-400",
    },
    {
      label: "SLA Breaches",
      value: ticketStats.sla_breaches || 0,
      tone: "text-rose-400",
    },
    {
      label: "Resolved",
      value: ticketStats.by_status?.resolved || 0,
      tone: "text-emerald-400",
    },
  ];

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
      {/* â”€â”€â”€ Welcome Header â”€â”€â”€ */}
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

      {/* â”€â”€â”€ KPI Cards â”€â”€â”€ */}
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

      {/* â”€â”€â”€ Main Panels â”€â”€â”€ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Employees - 2 cols */}
        <Card className="xl:col-span-2 bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="size-4 text-indigo-400" />
              Team Members
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
              >
                {activeEmployeesList.length} active
              </Badge>
              <button
                type="button"
                className="h-8 rounded-lg px-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
                onClick={() => onNavigate?.("employees")}
              >
                View all
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[560px] space-y-0.5 overflow-y-auto pr-1">
              {employees
                .filter((employee) => employee.is_active)
                .map((employee) => {
                  const fullName = `${employee.user_id?.first_name} ${employee.user_id?.last_name}`;
                  const initials = fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("");
                  const deptName = employee.department?.name || "-";
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
                        {employee.shift_type ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              employee.shift_type === "night"
                                ? "border-blue-500/20 text-blue-300"
                                : "border-orange-500/20 text-orange-300"
                            }`}
                          >
                            {employee.shift_type === "night"
                              ? "Night Shift"
                              : "Day Shift"}
                          </Badge>
                        ) : null}
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
          <Card className="bg-zinc-900/80 border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/80"
                  >
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">
                        {action.label}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{action.hint}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/80 border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Ticket className="size-4 text-amber-400" />
                Ticket Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {ticketOverview.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
                  >
                    <p className="text-xs text-zinc-500">{item.label}</p>
                    <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                          {count}
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
          {/* Recent Hires */}
          <Card className="bg-zinc-900/80 border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserPlus className="size-4 text-emerald-400" />
                Recent Hires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentHires.map((employee) => {
                  const fullName = `${employee.user_id?.first_name} ${employee.user_id?.last_name}`;
                  const initials = fullName
                    .split(" ")
                    .map((n) => n?.[0] || "")
                    .join("")
                    .slice(0, 2);
                  return (
                    <div key={employee._id} className="flex items-start gap-3">
                      <Avatar className="size-8 ring-1 ring-zinc-800">
                        <AvatarImage src={employee.user_id?.profile_picture} />
                        <AvatarFallback className="bg-zinc-800 text-[10px] text-zinc-300">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-300">
                          <span className="font-medium text-zinc-100">
                            {fullName}
                          </span>
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {employee.department?.name || "-"} · {employee.position}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {recentHires.length === 0 && (
                  <div className="py-10 text-center text-sm text-zinc-500">
                    No recent hires
                  </div>
                )}
              </div>
            </CardContent>
          </Card>        </div>
      </div>
    </div>
  );
}





