import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Home,
  MessageSquare,
  Users,
  FileText,
  Video,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Hexagon,
  Ticket,
  PenLine,
} from "lucide-react";
import EmployeeHome from "@/components/EmployeeHome";
import ChatInterface from "@/components/ChatInterface";
import MeetingModule from "@/components/MeetingModule";
import WhiteboardModule from "@/components/WhiteboardModule";
import FloatingMeetingBar from "@/components/FloatingMeetingBar";

import EmployeeTicketView from "@/components/EmployeeTicketView";
import DocumentsPage from "@/pages/documents/DocumentsPage";
import FileManager from "@/components/FileManager";
import { GlobalCallProvider } from "@/context/CallContextProvider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function EmployeeDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("messages");
  const [searchParams] = useSearchParams();
  const userData = JSON.parse(localStorage.getItem("user"));
  const [activeMeetingInfo, setActiveMeetingInfo] = useState(null);

  const handleMeetingStateChange = useCallback((meeting) => {
    setActiveMeetingInfo(meeting);
  }, []);

  useEffect(() => {
    if (searchParams.get("joinCode")) {
      setActiveTab("meetings");
    }
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("adminData");
    window.location.href = "/login";
  };

  const navItems = [
    // { id: "home", icon: Home, label: "Home" },
    { id: "messages", icon: MessageSquare, label: "Messages" },
    { id: "meetings", icon: Video, label: "Meetings" },
    { id: "files", icon: FileText, label: "Files" },
    // { id: "team", icon: Users, label: "Team" },
    // { id: "whiteboard", icon: PenLine, label: "Whiteboard" },
    { id: "tickets", icon: Ticket, label: "Tickets" },
  ];

  return (
    <GlobalCallProvider>
      <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
        <nav className="bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 sticky top-0 z-50">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="size-8 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Hexagon className="size-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-zinc-100 hidden sm:block">
                Enterprise Platform
              </span>
            </div>

            <div className="hidden md:flex items-center gap-0.5 p-1 bg-zinc-900/80 rounded-xl border border-zinc-800/60">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isActive
                        ? "bg-indigo-500/15 text-indigo-300 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs bg-indigo-500/20 text-indigo-300">
                        {userData?.first_name?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium text-zinc-200">
                      {userData?.first_name || "User"}
                    </span>
                    <ChevronDown className="size-3.5 text-zinc-500 hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-zinc-900 border-zinc-800">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-zinc-100 truncate">
                      {userData?.first_name} {userData?.last_name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{userData?.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem onClick={() => (window.location.href = "/profile")} className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100">
                    <User className="size-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                  >
                    <LogOut className="size-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t border-zinc-800/60 py-2 space-y-0.5 bg-zinc-900/80">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all rounded-lg",
                      isActive
                        ? "bg-indigo-500/15 text-indigo-300"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    )}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950">
        {/* Floating meeting bar — shown when in a meeting but on a different tab */}
        {activeMeetingInfo && activeTab !== "meetings" && (
          <FloatingMeetingBar
            meetingTitle={activeMeetingInfo.title || "Untitled Meeting"}
            isHost={!!activeMeetingInfo.isHost}
            isMuted={!!activeMeetingInfo.isMuted}
            isVideoOff={!!activeMeetingInfo.isVideoOff}
            onToggleMute={activeMeetingInfo.toggleMute}
            onToggleVideo={activeMeetingInfo.toggleVideo}
            onLeaveMeeting={activeMeetingInfo.leaveMeeting}
            onReturnToMeeting={() => setActiveTab("meetings")}
            startedAt={activeMeetingInfo.started_at || activeMeetingInfo.scheduled_at}
          />
        )}

        {/* {activeTab === "home" && <EmployeeHome onNavigate={setActiveTab} />} */}
        
        {activeTab === "messages" && <ChatInterface onNavigate={setActiveTab}  />}

        {/* {activeTab === "team" && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-xl font-semibold text-zinc-100 mb-1">Team</h1>
            <p className="text-sm text-zinc-500 mb-6">Manage your team members</p>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-12 text-center">
              <div className="size-14 rounded-full bg-zinc-800/80 flex items-center justify-center mx-auto mb-3">
                <Users className="size-6 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">Team management coming soon...</p>
              <p className="text-xs text-zinc-600 mt-1">View and collaborate with your team members</p>
            </div>
          </div>
        )} */}

        {activeTab === "files" && <FileManager />}

        {/* MeetingModule is ALWAYS mounted — hidden via CSS when not on the meetings tab */}
        <MeetingModule
          isVisible={activeTab === "meetings"}
          onMeetingStateChange={handleMeetingStateChange}
        />

        {/* WhiteboardModule is ALWAYS mounted — hidden via CSS when not on the whiteboard tab */}
        <WhiteboardModule isVisible={activeTab === "whiteboard"} />

        {activeTab === "tickets" && (
          <div className="flex-1 p-4 overflow-hidden">
            <EmployeeTicketView />
          </div>
        )}
      </main>
      </div>
    </GlobalCallProvider>
  );
}
