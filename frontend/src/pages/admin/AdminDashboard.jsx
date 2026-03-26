import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  LayoutDashboard,
  MessageSquare,
  Video,
  LogOut,
  Menu,
  X,
  User,
  ChevronLeft,
  ChevronRight,
  Hexagon,
  Building2,
  Ticket,
  ShieldCheck,
  FileText,
  Globe2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import EmployeeManagement from "./EmployeeManagement";
import Dashboard from "./Dashboard";
import AdminProfilePage from "./AdminProfilePage";
import DepartmentManagement from "./DepartmentManagement";
import AdminChangePasswordPage from "./AdminChangePasswordPage";
import TicketManagement from "./TicketManagement";
import RoleManagement from "./RoleManagement";
import ChatInterface from "@/components/ChatInterface";
import MeetingModule from "@/components/MeetingModule";
import FileManager from "@/components/FileManager";
import FloatingMeetingBar from "@/components/FloatingMeetingBar";
import CrossCountryCollaborationPanel from "@/components/CrossCountryCollaborationPanel";
import { GlobalCallProvider } from "@/context/CallContextProvider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMeetingInfo, setActiveMeetingInfo] = useState(null);
  const navigate = useNavigate();

  const handleMeetingStateChange = useCallback((meeting) => {
    setActiveMeetingInfo(meeting);
  }, []);
  const [searchParams] = useSearchParams();

  const adminData = useMemo(() => {
    try {
      const raw = localStorage.getItem("adminData") || localStorage.getItem("user");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, []);

  const adminName = adminData.first_name
    ? `${adminData.first_name} ${adminData.last_name || ""}`
    : "Admin";
  const adminInitials = adminName
    .split(" ")
    .map((n) => n?.[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    if (searchParams.get("joinCode")) {
      setCurrentPage("meetings");
    }
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("adminData");
    localStorage.removeItem("user");
    navigate("/adminLogin");
  };

  const handleNavigation = (page) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  const menuItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "employees", icon: Users, label: "Employees" },
    { id: "departments", icon: Building2, label: "Departments" },
    { id: "messages", icon: MessageSquare, label: "Messages" },
    { id: "meetings", icon: Video, label: "Meetings" },
    { id: "tickets", icon: Ticket, label: "Tickets" },
    { id: "files", icon: FileText, label: "Files" },
    { id: "global-collab", icon: Globe2, label: "Global Work" },
    { id: "roles", icon: ShieldCheck, label: "Roles & Access" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  const renderPageContent = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigation} />;
      case "employees":
        return <EmployeeManagement />;
      case "departments":
        return <DepartmentManagement />;
      case "messages":
        return <ChatInterface />;
      case "tickets":
        return <TicketManagement />;
      case "files":
        return <FileManager />;
      case "global-collab":
        return <CrossCountryCollaborationPanel />;
      case "roles":
        return <RoleManagement />;
      case "profile":
        return <AdminProfilePage onNavigate={handleNavigation} />;
      case "change-password":
        return <AdminChangePasswordPage onNavigate={handleNavigation} />;
      default:
        return null;
    }
  };

  return (
    <GlobalCallProvider>
      <div className="h-screen bg-background flex overflow-hidden">
        {/* ─── Sidebar - Desktop ─── */}
        <aside
          className={cn(
            "hidden lg:flex flex-col border-r border-border/60 transition-all duration-300 ease-in-out relative",
            "bg-gradient-to-b from-zinc-950 via-zinc-950/95 to-zinc-900/90",
            sidebarCollapsed ? "w-[68px]" : "w-64"
          )}
        >
          {/* Brand Header */}
          <div className="h-16 flex items-center px-4 gap-3 border-b border-white/[0.06]">
            <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
              <Hexagon className="size-4 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight truncate">
                  Enterprise
                </span>
                <span className="text-[10px] text-zinc-500 font-medium -mt-0.5">
                  Admin Portal
                </span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2",
                sidebarCollapsed ? "text-center" : "px-3"
              )}
            >
              {sidebarCollapsed ? "•" : "Menu"}
            </p>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    sidebarCollapsed && "justify-center px-0",
                    isActive
                      ? "bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-indigo-400 shadow-sm shadow-indigo-500/5"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                  )}
                  onClick={() => handleNavigation(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center flex-shrink-0",
                      isActive && "drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]"
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </div>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {isActive && !sidebarCollapsed && (
                    <div className="ml-auto size-1.5 rounded-full bg-indigo-400" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 size-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors z-10"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-3 text-zinc-400" />
            ) : (
              <ChevronLeft className="size-3 text-zinc-400" />
            )}
          </button>

          {/* User Footer */}
          <div className="border-t border-white/[0.06] p-3 space-y-1">
            <button
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors",
                sidebarCollapsed && "justify-center px-0"
              )}
              onClick={() => handleNavigation("profile")}
              title="View Profile"
            >
              <Avatar className="size-8 ring-2 ring-zinc-800">
                <AvatarImage src={adminData.profile_picture} />
                <AvatarFallback className="bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-300 text-[10px] font-semibold">
                  {adminInitials}
                </AvatarFallback>
              </Avatar>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-zinc-200 truncate">
                    {adminName}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {adminData.email || "Administrator"}
                  </p>
                </div>
              )}
            </button>
            <button
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors text-sm",
                sidebarCollapsed && "justify-center px-0"
              )}
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="size-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar - Mobile */}
          <header className="lg:hidden h-14 bg-zinc-950 border-b border-white/[0.06] flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Hexagon className="size-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold">Enterprise</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-zinc-500 hover:text-red-400 size-9"
              >
                <LogOut className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="size-5" />
                ) : (
                  <Menu className="size-5" />
                )}
              </Button>
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="lg:hidden bg-zinc-950 border-b border-white/[0.06] p-2 space-y-0.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-indigo-500/15 text-indigo-400"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                    )}
                    onClick={() => handleNavigation(item.id)}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <main className="flex-1 flex flex-col min-h-0 overflow-auto bg-zinc-950/50">
            {/* Floating meeting bar */}
            {activeMeetingInfo && currentPage !== "meetings" && (
              <FloatingMeetingBar
                meetingTitle={activeMeetingInfo.title || "Untitled Meeting"}
                isHost={!!activeMeetingInfo.isHost}
                isMuted={!!activeMeetingInfo.isMuted}
                isVideoOff={!!activeMeetingInfo.isVideoOff}
                onToggleMute={activeMeetingInfo.toggleMute}
                onToggleVideo={activeMeetingInfo.toggleVideo}
                onLeaveMeeting={activeMeetingInfo.leaveMeeting}
                onReturnToMeeting={() => handleNavigation("meetings")}
                startedAt={activeMeetingInfo.started_at || activeMeetingInfo.scheduled_at}
              />
            )}

            {currentPage !== "meetings" && renderPageContent()}

            {/* MeetingModule is ALWAYS mounted — hidden via CSS when not on the meetings tab */}
            <MeetingModule
              isVisible={currentPage === "meetings"}
              onMeetingStateChange={handleMeetingStateChange}
            />


          </main>
        </div>
      </div>
    </GlobalCallProvider>
  );
}
