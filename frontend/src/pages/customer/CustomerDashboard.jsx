import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import MeetingModule from "@/components/MeetingModule";
import FloatingMeetingBar from "@/components/FloatingMeetingBar";

import {
  Plus,
  Send,
  LogOut,
  Ticket,
  MessageCircle,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  HeadphonesIcon,
  User,
  RefreshCcw,
  Paperclip,
  FileText,
  Download,
  Video,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { BACKEND_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/context/AuthContextProvider";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

function isImageUrl(url) {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) || url.includes("/image/upload/");
}

function MeetingCard({ meta }) {
  let data;
  try { data = JSON.parse(meta); } catch { return null; }
  const date = data.scheduled_at ? new Date(data.scheduled_at) : null;
  return (
    <div className="border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 rounded-xl p-3 max-w-[300px] w-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center flex-shrink-0">
          <Video className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
        </div>
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Support Meeting Scheduled</span>
      </div>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">{data.title}</p>
      {date && (
        <p className="text-xs text-muted-foreground mb-1">
          {date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          {data.duration ? ` · ${data.duration} min` : ""}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">Go to the <strong>Meetings</strong> tab to join when the host starts the meeting.</p>
    </div>
  );
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, socket } = useAuthContext();
  const [showMeeting, setShowMeeting] = useState(false);
  const [activeView, setActiveView] = useState("tickets");
  const [activeMeetingInfo, setActiveMeetingInfo] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showSatisfactionForm, setShowSatisfactionForm] = useState(false);
  const [satisfactionForm, setSatisfactionForm] = useState({ rating: 5, comment: "" });
  const [ticketForm, setTicketForm] = useState({
    title: "",
    description: "",
    category: "",
    urgency_level: 2,
    subscription_tier: "pro",
  });
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem("token");
  const headers = token && token !== "undefined" && token !== "null"
    ? { Authorization: `Bearer ${token}` }
    : {};

  const fetchTickets = useCallback(async () => {
    if (!token) return; // Skip if no token
    try {
      const res = await axios.get(`${BACKEND_URL}/tickets/my-tickets`, { headers });
      setTickets(res.data.tickets);
    } catch (err) {
      console.error("Fetch tickets error:", err);
      if (err.response?.status === 401) {
        // Token is invalid, clear it
        localStorage.removeItem("token");
        localStorage.removeItem("customerData");
      }
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  const fetchMessages = useCallback(async (ticketId) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/tickets/${ticketId}/messages`, { headers });
      setMessages(res.data.messages);
    } catch (err) {
      console.error("Fetch messages error:", err);
    }
  }, []);

  // Check if token exists and is valid
  useEffect(() => {
    if (!token || token === "undefined" || token === "null") {
      // No valid token, redirect to login
      navigate("/customer/login", { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (!socket || !selectedTicket) return;
    socket.emit("ticket-join", { ticketId: selectedTicket._id });
    return () => {
      socket.emit("ticket-leave", { ticketId: selectedTicket._id });
    };
  }, [socket, selectedTicket?._id]);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ ticketId, message }) => {
      if (selectedTicket && ticketId === selectedTicket._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }
    };
    socket.on("ticket-new-message", handler);
    return () => socket.off("ticket-new-message", handler);
  }, [socket, selectedTicket?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket._id);
    setShowCreateForm(false);
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/tickets`, ticketForm, { headers });
      toast.success("Ticket created successfully - auto-assigned to an agent");
      setTicketForm({ 
        title: "", 
        description: "", 
        category: "",
        urgency_level: 2,
        subscription_tier: "pro",
      });
      setShowCreateForm(false);
      fetchTickets();
      setSelectedTicket(res.data.ticket);
      fetchMessages(res.data.ticket._id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitSatisfaction = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${BACKEND_URL}/tickets/${selectedTicket._id}/satisfaction`,
        satisfactionForm,
        { headers }
      );
      toast.success("Thank you for your feedback!");
      setSelectedTicket(res.data.ticket);
      setShowSatisfactionForm(false);
      setSatisfactionForm({ rating: 5, comment: "" });
    } catch (err) {
      toast.error("Failed to submit rating");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    setSendingMessage(true);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/tickets/${selectedTicket._id}/messages`,
        { content: newMessage.trim() },
        { headers }
      );
      socket?.emit("ticket-message", {
        ticketId: selectedTicket._id,
        message: res.data.message,
      });
      setMessages((prev) => {
        if (prev.some((m) => m._id === res.data.message._id)) return prev;
        return [...prev, res.data.message];
      });
      setNewMessage("");
    } catch (err) {
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTicket) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(
        `${BACKEND_URL}/tickets/${selectedTicket._id}/messages/upload`,
        formData,
        { headers: { ...headers, "Content-Type": "multipart/form-data" } }
      );
      socket?.emit("ticket-message", {
        ticketId: selectedTicket._id,
        message: res.data.message,
      });
      setMessages((prev) => {
        if (prev.some((m) => m._id === res.data.message._id)) return prev;
        return [...prev, res.data.message];
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload file");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (searchParams.get("joinCode")) {
      setActiveView("meetings");
    }
  }, [searchParams]);

  const handleMeetingStateChange = useCallback((meeting) => {
    setActiveMeetingInfo(meeting);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("customerData");
    localStorage.removeItem("token");
    navigate("/customer/login");
  };

  const userId = user?.id || user?._id;

  const visibleTickets = showResolved
    ? tickets
    : tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");

  const resolvedCount = tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed"
  ).length;

if (showMeeting) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="h-12 border-b flex items-center px-4 gap-3 bg-white dark:bg-zinc-950 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => { setShowMeeting(false); navigate("/customer/dashboard", { replace: true }); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Support
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Support Meeting</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <MeetingModule />
        </div>
      </div>
    );
  }

 return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800/60 flex items-center justify-between px-4 bg-zinc-950/90 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <HeadphonesIcon className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-zinc-100">Customer Portal</span>
          <div className="flex items-center gap-0.5 ml-4 p-1 bg-zinc-900/80 rounded-xl border border-zinc-800/60">
            <button
              onClick={() => setActiveView("tickets")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === "tickets"
                  ? "bg-blue-500/15 text-blue-300 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <Ticket className="h-3.5 w-3.5" />
              Tickets
            </button>
            <button
              onClick={() => setActiveView("meetings")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === "meetings"
                  ? "bg-blue-500/15 text-blue-300 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              Meetings
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">

            {user?.first_name} {user?.last_name}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-400 hover:text-zinc-200">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Floating meeting bar — shown when in a meeting but not on meetings tab */}
      {activeMeetingInfo && activeView !== "meetings" && (
        <FloatingMeetingBar
          meetingTitle={activeMeetingInfo.title || "Untitled Meeting"}
          isHost={!!activeMeetingInfo.isHost}
          isMuted={!!activeMeetingInfo.isMuted}
          isVideoOff={!!activeMeetingInfo.isVideoOff}
          onToggleMute={activeMeetingInfo.toggleMute}
          onToggleVideo={activeMeetingInfo.toggleVideo}
          onLeaveMeeting={activeMeetingInfo.leaveMeeting}
          onReturnToMeeting={() => setActiveView("meetings")}
          startedAt={activeMeetingInfo.started_at || activeMeetingInfo.scheduled_at}
        />
      )}

      {/* MeetingModule is always mounted — hidden via CSS when not on meetings tab */}
      <MeetingModule
        isVisible={activeView === "meetings"}
        onMeetingStateChange={handleMeetingStateChange}
        readOnly
      />

      {activeView === "tickets" && (
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-zinc-800/60 flex flex-col bg-zinc-950 flex-shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-sm">My Tickets</h2>
              {resolvedCount > 0 && (
                <button
                  onClick={() => setShowResolved((v) => !v)}
                  title={showResolved ? "Hide resolved" : `Show ${resolvedCount} resolved`}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showResolved ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  {!showResolved && resolvedCount}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchTickets}
                className="h-7 w-7 p-0"
                title="Refresh tickets"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(true);
                  setSelectedTicket(null);
                }}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : visibleTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Ticket className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {tickets.length === 0 ? "No tickets yet" : "No active tickets"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {tickets.length === 0
                    ? "Create your first support ticket"
                    : "All tickets are resolved"}
                </p>
              </div>
            ) : (
              visibleTickets.map((ticket) => (
                <div
                  key={ticket._id}
                  onClick={() => handleSelectTicket(ticket)}
                  className={`p-3 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
                    selectedTicket?._id === ticket._id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm truncate flex-1">{ticket.title}</h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        statusColors[ticket.status]
                      }`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {ticket.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        priorityColors[ticket.priority]
                      }`}
                    >
                      {ticket.priority}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ticket.ticket_number}
                    </span>
                  </div>
                  {ticket.assigned_agent_id?.user_id && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Agent: {ticket.assigned_agent_id.user_id.first_name}{" "}
                      {ticket.assigned_agent_id.user_id.last_name}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {showCreateForm ? (
            <div className="flex-1 flex items-start justify-center p-8 overflow-y-auto">
              <div className="w-full max-w-lg">
                <h2 className="text-xl font-bold mb-6">Create Support Ticket</h2>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Brief description of your issue"
                      value={ticketForm.title}
                      onChange={(e) =>
                        setTicketForm({ ...ticketForm, title: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      placeholder="Provide details about your issue..."
                      value={ticketForm.description}
                      onChange={(e) =>
                        setTicketForm({ ...ticketForm, description: e.target.value })
                      }
                      required
                      rows={5}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      placeholder="e.g. Billing, Technical"
                      value={ticketForm.category}
                      onChange={(e) =>
                        setTicketForm({ ...ticketForm, category: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgency">How urgent is this issue?</Label>
                    <div className="space-y-1.5">
                      {[
                        { value: 1, label: "Low - Minor inconvenience, no business impact" },
                        { value: 2, label: "Medium - Affecting some operations" },
                        { value: 3, label: "High - Significant business impact" },
                        { value: 4, label: "Critical - Major operations affected" },
                        { value: 5, label: "Emergency - System completely down" },
                      ].map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="urgency"
                            value={opt.value}
                            checked={ticketForm.urgency_level === opt.value}
                            onChange={(e) =>
                              setTicketForm({
                                ...ticketForm,
                                urgency_level: parseInt(e.target.value),
                              })
                            }
                            className="rounded"
                          />
                          <span className="text-sm text-muted-foreground">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={creating}
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create Ticket"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : selectedTicket ? (
            <>
              {/* Ticket Header */}
              <div className="h-14 border-b flex items-center gap-3 px-4 flex-shrink-0 bg-white dark:bg-zinc-950">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8"
                  onClick={() => setSelectedTicket(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{selectedTicket.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {selectedTicket.ticket_number}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        statusColors[selectedTicket.status]
                      }`}
                    >
                      {selectedTicket.status.replace("_", " ")}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        priorityColors[selectedTicket.priority]
                      }`}
                    >
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>
                {selectedTicket.status !== "resolved" &&
                  selectedTicket.status !== "closed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await axios.put(
                            `${BACKEND_URL}/tickets/${selectedTicket._id}/status`,
                            { status: "resolved" },
                            { headers }
                          );
                          toast.success("Ticket resolved! Please rate your experience.");
                          setSelectedTicket({ ...selectedTicket, status: "resolved" });
                          setShowSatisfactionForm(true);
                          fetchTickets();
                        } catch {
                          toast.error("Failed to resolve");
                        }
                      }}
                      className="gap-1 text-green-600"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolve
                    </Button>
                  )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-zinc-900">
                {messages.map((msg) => {
                  if (msg.message_type === "system") {
                    return (
                      <div key={msg._id} className="flex justify-center">
                        <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  if (msg.message_type === "meeting") {
                    return (
                      <div key={msg._id} className="flex justify-center my-2">
                        <MeetingCard meta={msg.content} />
                      </div>
                    );
                  }

                  const isMe = msg.sender_id?._id === userId || msg.sender_id === userId;

                  if (msg.message_type === "file") {
                    const isImage = isImageUrl(msg.file_url);
                    return (
                      <div
                        key={msg._id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl overflow-hidden border ${
                            isMe ? "border-blue-400" : "border-gray-200 dark:border-zinc-700"
                          }`}
                        >
                          {!isMe && msg.sender_id?.first_name && (
                            <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 px-3 pt-2">
                              {msg.sender_id.first_name} {msg.sender_id.last_name}
                              {msg.sender_id.user_type === "employee" && " (Agent)"}
                            </p>
                          )}
                          {isImage ? (
                            <img
                              src={msg.file_url}
                              alt={msg.file_name}
                              className="max-w-full max-h-48 object-cover cursor-pointer"
                              onClick={() => window.open(msg.file_url, "_blank")}
                            />
                          ) : (
                            <div
                              className={`flex items-center gap-3 px-3 py-2 ${
                                isMe
                                  ? "bg-blue-600 text-white"
                                  : "bg-white dark:bg-zinc-800"
                              }`}
                            >
                              <FileText className="h-5 w-5 flex-shrink-0" />
                              <span className="text-sm truncate max-w-[160px]">
                                {msg.file_name}
                              </span>
                              <a
                                href={msg.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={msg.file_name}
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          )}
                          <p
                            className={`text-[10px] px-3 pb-1.5 ${
                              isMe ? "text-blue-200 bg-blue-600" : "text-muted-foreground bg-white dark:bg-zinc-800"
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          isMe
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-white dark:bg-zinc-800 border rounded-bl-md"
                        }`}
                      >
                        {!isMe && msg.sender_id?.first_name && (
                          <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-0.5">
                            {msg.sender_id.first_name} {msg.sender_id.last_name}
                            {msg.sender_id.user_type === "employee" && " (Agent)"}
                            {msg.sender_id.user_type === "admin" && " (Admin)"}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isMe ? "text-blue-200" : "text-muted-foreground"
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedTicket.assigned_agent_id &&
              selectedTicket.status !== "resolved" &&
              selectedTicket.status !== "closed" ? (
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t flex gap-2 bg-white dark:bg-zinc-950"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    disabled={uploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                  >
                    {uploadingFile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={sendingMessage || !newMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              ) : !selectedTicket.assigned_agent_id ? (
                <div className="p-4 border-t bg-yellow-50 dark:bg-yellow-900/20 text-center">
                  <div className="flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <Clock className="h-4 w-4" />
                    <p className="text-sm">Waiting for an agent to be assigned...</p>
                  </div>
                </div>
              ) : showSatisfactionForm && selectedTicket.status === "resolved" ? (
                <div className="p-4 border-t bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center justify-center mb-4">
                    <h3 className="font-semibold text-sm">How was your experience?</h3>
                  </div>
                  <form onSubmit={handleSubmitSatisfaction} className="space-y-3">
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setSatisfactionForm({ ...satisfactionForm, rating })}
                          className={`text-2xl transition-transform hover:scale-125 ${
                            satisfactionForm.rating >= rating ? "opacity-100" : "opacity-30"
                          }`}
                        >
                          ⭐
                        </button>
                      ))}
                    </div>
                    <textarea
                      placeholder="Any additional comments? (optional)"
                      value={satisfactionForm.comment}
                      onChange={(e) =>
                        setSatisfactionForm({ ...satisfactionForm, comment: e.target.value })
                      }
                      rows={2}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSatisfactionForm(false)}
                      >
                        Skip
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Submit Feedback
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-4 border-t bg-green-50 dark:bg-green-900/20 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">This ticket has been resolved.</p>
                      {selectedTicket.satisfaction_rating && (
                        <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                          You rated this ticket {selectedTicket.satisfaction_rating}⭐
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageCircle className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="font-semibold text-lg">Welcome to Support</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Select a ticket to view the conversation, or create a new ticket to get help.
              </p>
              <Button
                className="mt-6 bg-blue-600 hover:bg-blue-700 gap-2"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4" />
                Create Ticket
              </Button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
