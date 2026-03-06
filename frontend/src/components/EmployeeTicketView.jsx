import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Send,
  Ticket,
  Loader2,
  ChevronLeft,
  CheckCircle2,
  Clock,
  MessageCircle,
  User,
  UserPlus,
  X,
  Paperclip,
  FileText,
  Download,
  Video,
  Eye,
  EyeOff,
  CalendarPlus,
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
    <div className="border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 rounded-xl p-3 max-w-[300px] w-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center flex-shrink-0">
          <Video className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
        </div>
        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Support Meeting Scheduled</span>
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

export default function EmployeeTicketView() {
  const { user, socket } = useAuthContext();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Collaborator modal
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [addingCollab, setAddingCollab] = useState(false);
  const [selectedCollab, setSelectedCollab] = useState("");
  const [removingCollabId, setRemovingCollabId] = useState(null);

  // Schedule meeting modal
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: "",
    scheduled_at: "",
    duration_minutes: 30,
  });
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchTickets = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/tickets/assigned`, { headers });
      setTickets(res.data.tickets);
    } catch (err) {
      console.error("Fetch assigned tickets error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (ticketId) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/tickets/${ticketId}/messages`, { headers });
      setMessages(res.data.messages);
    } catch (err) {
      console.error("Fetch messages error:", err);
    }
  }, []);

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

  const fetchAllEmployees = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/tickets/all-employees`, { headers });
      setAllEmployees(res.data.employees);
    } catch (err) {
      toast.error("Failed to load employees");
    }
  };

  const handleOpenCollabModal = () => {
    setSelectedCollab("");
    fetchAllEmployees();
    setShowCollabModal(true);
  };

  const handleAddCollaborator = async () => {
    if (!selectedCollab || !selectedTicket) return;
    setAddingCollab(true);
    try {
      await axios.post(
        `${BACKEND_URL}/tickets/${selectedTicket._id}/collaborators`,
        { employee_id: selectedCollab },
        { headers }
      );
      toast.success("Collaborator added");
      setShowCollabModal(false);
      fetchTickets();
      fetchMessages(selectedTicket._id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add collaborator");
    } finally {
      setAddingCollab(false);
    }
  };

  const handleRemoveCollaborator = async (employeeId) => {
    if (!selectedTicket) return;
    setRemovingCollabId(employeeId);
    try {
      await axios.delete(
        `${BACKEND_URL}/tickets/${selectedTicket._id}/collaborators/${employeeId}`,
        { headers }
      );
      toast.success("Collaborator removed");
      fetchTickets();
      fetchMessages(selectedTicket._id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to remove collaborator");
    } finally {
      setRemovingCollabId(null);
    }
  };

  const handleOpenMeetingModal = () => {
    setMeetingForm({
      title: `Support: ${selectedTicket?.ticket_number || ""}`,
      scheduled_at: "",
      duration_minutes: 30,
    });
    setShowMeetingModal(true);
  };

  const handleScheduleMeeting = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setSchedulingMeeting(true);
    try {
      const payload = {
        title: meetingForm.title,
        duration_minutes: Number(meetingForm.duration_minutes),
      };
      if (meetingForm.scheduled_at) payload.scheduled_at = meetingForm.scheduled_at;

      const res = await axios.post(
        `${BACKEND_URL}/tickets/${selectedTicket._id}/schedule-meeting`,
        payload,
        { headers }
      );
      toast.success("Meeting scheduled!");
      setShowMeetingModal(false);
      // Add meeting message to local state
      setMessages((prev) => {
        if (prev.some((m) => m._id === res.data.message._id)) return prev;
        return [...prev, res.data.message];
      });
      socket?.emit("ticket-message", {
        ticketId: selectedTicket._id,
        message: res.data.message,
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to schedule meeting");
    } finally {
      setSchedulingMeeting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedTicket) return;
    try {
      await axios.put(
        `${BACKEND_URL}/tickets/${selectedTicket._id}/status`,
        { status: "resolved" },
        { headers }
      );
      toast.success("Ticket resolved!");
      setSelectedTicket({ ...selectedTicket, status: "resolved" });
      fetchTickets();
    } catch {
      toast.error("Failed to resolve");
    }
  };

  const userId = user?.id || user?._id;

  const isAssignedAgent =
    selectedTicket?.assigned_agent_id?.user_id &&
    (selectedTicket.assigned_agent_id.user_id._id === userId ||
      selectedTicket.assigned_agent_id.user_id._id?.toString() === userId?.toString());

  const resolvedCount = tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed"
  ).length;

  const visibleTickets = showResolved
    ? tickets
    : tickets.filter((t) => t.status !== "resolved" && t.status !== "closed");

  return (
    <div className="flex h-full overflow-hidden border rounded-lg bg-white dark:bg-zinc-950">
      {/* Ticket List */}
      <div className="w-80 border-r flex flex-col flex-shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              My Tickets
            </h2>
            {resolvedCount > 0 && (
              <button
                onClick={() => setShowResolved((v) => !v)}
                title={showResolved ? "Hide resolved" : `Show ${resolvedCount} resolved`}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showResolved ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {!showResolved && resolvedCount}
              </button>
            )}
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
                {tickets.length === 0
                  ? "No tickets assigned to you or shared as collaborator"
                  : "No active tickets"}
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
                  {ticket.customer_id?.user_id && (
                    <span className="text-[10px] text-muted-foreground">
                      {ticket.customer_id.user_id.first_name}{" "}
                      {ticket.customer_id.user_id.last_name}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedTicket ? (
          <>
            {/* Header */}
            <div className="border-b flex items-center gap-3 px-4 py-2 flex-shrink-0 min-h-[56px]">
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
                <div className="flex flex-wrap items-center gap-2">
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
                  {selectedTicket.customer_id?.user_id && (
                    <span className="text-xs text-muted-foreground">
                      Customer: {selectedTicket.customer_id.user_id.first_name}{" "}
                      {selectedTicket.customer_id.user_id.last_name}
                    </span>
                  )}
                  {selectedTicket.collaborators?.length > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                      · Collaborators:{" "}
                      {selectedTicket.collaborators.map((c, idx) => (
                        <span key={c._id} className="inline-flex items-center gap-0.5">
                          {c.user_id?.first_name} {c.user_id?.last_name}
                          {isAssignedAgent &&
                            selectedTicket.status !== "resolved" &&
                            selectedTicket.status !== "closed" && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCollaborator(c._id)}
                                disabled={removingCollabId === c._id}
                                className="ml-0.5 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
                                title={`Remove ${c.user_id?.first_name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          {idx < selectedTicket.collaborators.length - 1 && ","}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAssignedAgent &&
                  selectedTicket.status !== "resolved" &&
                  selectedTicket.status !== "closed" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenMeetingModal}
                        className="gap-1 text-xs"
                        title="Schedule a meeting/call with customer"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Schedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenCollabModal}
                        className="gap-1 text-xs"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Add Collaborator
                      </Button>
                    </>
                  )}
                {selectedTicket.status !== "resolved" &&
                  selectedTicket.status !== "closed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResolve}
                      className="gap-1 text-green-600"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolve
                    </Button>
                  )}
              </div>
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

                const isMe =
                  msg.sender_id?._id === userId || msg.sender_id === userId;

                if (msg.message_type === "file") {
                  const isImage = isImageUrl(msg.file_url);
                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl overflow-hidden border ${
                          isMe ? "border-indigo-400" : "border-gray-200 dark:border-zinc-700"
                        }`}
                      >
                        {!isMe && msg.sender_id?.first_name && (
                          <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 px-3 pt-2">
                            {msg.sender_id.first_name} {msg.sender_id.last_name}
                            {msg.sender_id.user_type === "customer" && " (Customer)"}
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
                                ? "bg-indigo-600 text-white"
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
                            isMe
                              ? "text-indigo-200 bg-indigo-600"
                              : "text-muted-foreground bg-white dark:bg-zinc-800"
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
                          ? "bg-indigo-600 text-white rounded-br-md"
                          : "bg-white dark:bg-zinc-800 border rounded-bl-md"
                      }`}
                    >
                      {!isMe && msg.sender_id?.first_name && (
                        <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 mb-0.5">
                          {msg.sender_id.first_name} {msg.sender_id.last_name}
                          {msg.sender_id.user_type === "customer" && " (Customer)"}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          isMe ? "text-indigo-200" : "text-muted-foreground"
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

            {/* Input */}
            {selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" ? (
              <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2">
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
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            ) : (
              <div className="p-4 border-t bg-green-50 dark:bg-green-900/20 text-center">
                <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-sm">This ticket has been resolved.</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageCircle className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="font-semibold text-lg">Support Tickets</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Select a ticket to start chatting with the customer
            </p>
          </div>
        )}
      </div>

      {/* Schedule Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Video className="h-4 w-4 text-indigo-600" />
                Schedule Meeting / Call
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowMeetingModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule a video/audio meeting with the customer. They will receive a join code in the ticket chat.
              <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400">
                Note: Customers cannot initiate or record meetings.
              </span>
            </p>
            <form onSubmit={handleScheduleMeeting} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Meeting Title</Label>
                <Input
                  value={meetingForm.title}
                  onChange={(e) =>
                    setMeetingForm({ ...meetingForm, title: e.target.value })
                  }
                  placeholder="e.g. Support call with customer"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Scheduled Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={meetingForm.scheduled_at}
                  onChange={(e) =>
                    setMeetingForm({ ...meetingForm, scheduled_at: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to start immediately
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <select
                  value={meetingForm.duration_minutes}
                  onChange={(e) =>
                    setMeetingForm({
                      ...meetingForm,
                      duration_minutes: Number(e.target.value),
                    })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMeetingModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={schedulingMeeting}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {schedulingMeeting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Schedule"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Collaborator Modal */}
      {showCollabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Add Collaborator</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowCollabModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Select an employee from any department to collaborate on this ticket:
            </p>
            <div className="space-y-3">
              <select
                value={selectedCollab}
                onChange={(e) => setSelectedCollab(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select employee...</option>
                {allEmployees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.user_id?.first_name} {emp.user_id?.last_name} —{" "}
                    {emp.department?.name || "N/A"} (
                    {emp.employee_type === "customer_support"
                      ? "Support"
                      : emp.position || "N/A"}
                    )
                  </option>
                ))}
              </select>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCollabModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddCollaborator}
                  disabled={!selectedCollab || addingCollab}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {addingCollab ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
