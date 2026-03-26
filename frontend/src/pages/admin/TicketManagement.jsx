import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Ticket,
  Loader2,
  UserPlus,
  Search,
  ChevronDown,
  ExternalLink,
  X,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { BACKEND_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function TicketManagement() {
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignModal, setAssignModal] = useState(null); // ticketId
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [assigning, setAssigning] = useState(false);
  
  const token = localStorage.getItem("token");
  const headers = token && token !== "undefined" && token !== "null"
    ? { Authorization: `Bearer ${token}` }
    : {};

  const fetchTickets = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/tickets/all`, { headers });
      setTickets(res.data.tickets);
    } catch (err) {
      console.error("Fetch tickets error:", err);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/tickets/internal-employees`, {
        headers,
      });
      setEmployees(res.data.employees);
    } catch (err) {
      console.error("Fetch employees error:", err);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchEmployees();
  }, [fetchTickets, fetchEmployees]);

  const handleAssign = async () => {
    if (!selectedEmployee || !assignModal) return;
    setAssigning(true);
    try {
      await axios.put(
        `${BACKEND_URL}/tickets/${assignModal}/assign`,
        { employee_id: selectedEmployee },
        { headers }
      );
      toast.success("Ticket assigned successfully");
      setAssignModal(null);
      setSelectedEmployee("");
      fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to assign ticket");
    } finally {
      setAssigning(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTickets(), fetchEmployees()]);
    setRefreshing(false);
  };

  const handlePriorityChange = async (ticketId, newPriority) => {
    try {
      await axios.put(
        `${BACKEND_URL}/tickets/${ticketId}/priority`,
        { priority: newPriority },
        { headers }
      );
      toast.success(`Ticket priority updated to ${newPriority}`);
      fetchTickets();
    } catch (err) {
      toast.error("Failed to update priority");
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await axios.put(
        `${BACKEND_URL}/tickets/${ticketId}/status`,
        { status: newStatus },
        { headers }
      );
      toast.success(`Ticket status updated to ${newStatus}`);
      fetchTickets();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customer_id?.user_id?.email
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Manage and assign customer support tickets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ticket className="h-4 w-4" />
            {tickets.length} total tickets
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Tickets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Ticket className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No tickets found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Ticket</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Assigned To</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => (
                  <tr
                    key={ticket._id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[200px]">
                        {ticket.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.ticket_number}
                      </p>
                    </td>
                    <td className="p-3">
                      {ticket.customer_id?.user_id ? (
                        <div>
                          <p className="font-medium">
                            {ticket.customer_id.user_id.first_name}{" "}
                            {ticket.customer_id.user_id.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ticket.customer_id.user_id.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={ticket.priority || "medium"}
                        onChange={(e) =>
                          handlePriorityChange(ticket._id, e.target.value)
                        }
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${
                          priorityColors[ticket.priority]
                        }`}
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="critical">critical</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <select
                        value={ticket.status}
                        onChange={(e) =>
                          handleStatusChange(ticket._id, e.target.value)
                        }
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${
                          statusColors[ticket.status]
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="p-3">
                      {ticket.assigned_agent_id?.user_id ? (
                        <div>
                          <p className="font-medium text-xs">
                            {ticket.assigned_agent_id.user_id.first_name}{" "}
                            {ticket.assigned_agent_id.user_id.last_name}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {!ticket.assigned_agent_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setAssignModal(ticket._id)}
                          >
                            <UserPlus className="h-3 w-3" />
                            Assign
                          </Button>
                        )}
                        {ticket.assigned_agent_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setAssignModal(ticket._id)}
                          >
                            Reassign
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">
                Assign Ticket to Employee
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setAssignModal(null);
                  setSelectedEmployee("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Select an internal team employee to handle this ticket:
            </p>

            <div className="space-y-3">
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select employee...</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.user_id?.first_name} {emp.user_id?.last_name} -{" "}
                    {emp.department?.name || "N/A"} ({emp.position || "N/A"})
                  </option>
                ))}
              </select>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAssignModal(null);
                    setSelectedEmployee("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssign}
                  disabled={!selectedEmployee || assigning}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {assigning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Assign"
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

