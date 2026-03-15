import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Video,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Hexagon,
  Ticket,
  Globe2,
} from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import MeetingModule from "@/components/MeetingModule";
import FloatingMeetingBar from "@/components/FloatingMeetingBar";
import CrossCountryCollaborationPanel from "@/components/CrossCountryCollaborationPanel";

import EmployeeTicketView from "@/components/EmployeeTicketView";
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
    { id: "messages", icon: MessageSquare, label: "Messages" },
    { id: "meetings", icon: Video, label: "Meetings" },
    { id: "files", icon: FileText, label: "Files" },
    { id: "tickets", icon: Ticket, label: "Tickets" },
    { id: "global-work", icon: Globe2, label: "Global Work" },
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

        {activeTab === "messages" && <ChatInterface onNavigate={setActiveTab} />}

        {activeTab === "files" && <FileManager />}

        {/* MeetingModule is ALWAYS mounted — hidden via CSS when not on the meetings tab */}
        <MeetingModule
          isVisible={activeTab === "meetings"}
          onMeetingStateChange={handleMeetingStateChange}
        />



        {activeTab === "tickets" && (
          <div className="flex-1 p-4 overflow-hidden">
            <EmployeeTicketView />
          </div>
        )}

        {activeTab === "global-work" && (
          <div className="flex-1 overflow-hidden">
            <CrossCountryCollaborationPanel />
          </div>
        )}
      </main>
      </div>
    </GlobalCallProvider>
  );
}
