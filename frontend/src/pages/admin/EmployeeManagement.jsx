import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Search,
  Users,
  UserPlus,
  MoreVertical,
  Pencil,
  Key,
  Mail,
  Loader2,
  X,
  AlertCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
//import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";

const EMPLOYEE_TYPES = [
  { value: "internal_team", label: "Internal Team" },
  { value: "customer_support", label: "Customer Support" },
];

// Departments are now fetched dynamically from the API

const COUNTRIES = [
  { value: "india", label: "India" },
  { value: "germany", label: "Germany" },
  { value: "usa", label: "USA" },
];

const POSITIONS = [
  { value: "ceo", label: "CEO" },
  { value: "cto", label: "CTO" },
  { value: "project_manager", label: "Project Manager" },
  { value: "team_lead", label: "Team Lead" },
  { value: "senior_engineer", label: "Senior Engineer" },
  { value: "engineer", label: "Engineer" },
  { value: "junior_engineer", label: "Junior Engineer" },
  { value: "intern", label: "Intern" },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
];

const SHIFT_OPTIONS = [
  { value: "day", label: "Day Shift (10 AM - 7 PM)" },
  { value: "night", label: "Night Shift (7 PM - 4 AM)" },
];

const SHIFT_BADGE_CLASSES = {
  day: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  night: "border-violet-500/20 bg-violet-500/10 text-violet-300",
};

const POSITION_LABELS = {
  ceo: "CEO",
  cto: "CTO",
  project_manager: "Project Manager",
  team_lead: "Team Lead",
  senior_engineer: "Senior Engineer",
  engineer: "Engineer",
  junior_engineer: "Junior Engineer",
  intern: "Intern",
};

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const initialFormData = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  country: "",
  timezone: "",
  shift_type: "",
  employee_type: "internal_team",
  department: "",
  position: "",
  team_lead_id: "",
  hire_date: new Date().toISOString().split("T")[0],
};

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // "list" | "create"
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [passwordModalEmployee, setPasswordModalEmployee] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [passwordResetMode, setPasswordResetMode] = useState("temp"); // "temp" | "direct"
  const [directPassword, setDirectPassword] = useState("");
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [departments, setDepartments] = useState([]);
  const searchTimerRef = useRef(null);

  const positionsRequiringTeamLead = ["senior_engineer", "engineer", "junior_engineer", "intern"];
  const shouldShowPosition = formData.employee_type === "internal_team";
  const shouldShowDepartment =
    formData.employee_type === "internal_team" &&
    formData.position &&
    ["project_manager", "team_lead", "senior_engineer", "engineer", "junior_engineer", "intern"].includes(formData.position);
  const shouldShowTeamLead =
    formData.employee_type === "internal_team" &&
    formData.position &&
    positionsRequiringTeamLead.includes(formData.position);
  const shouldShowShift = formData.country === "india";

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchTerm]);

  // Reset page on department filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterDepartment, filterShift]);

  // Fetch employees with server-side pagination
  const fetchEmployees = useCallback(async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
      });
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (filterDepartment && filterDepartment !== "all") params.append("department", filterDepartment);
      if (filterShift && filterShift !== "all") params.append("shift_type", filterShift);

      const { data } = await axios.get(`${BACKEND_URL}/employees/?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      setEmployees(data.employees || []);
      if (data.pagination) {
        setTotalEmployees(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        setTotalEmployees(data.employees?.length || 0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, filterDepartment, filterShift]);

  const fetchTeamLeads = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/helper/getTeamLead`, {
        headers: getAuthHeaders(),
      });
      setTeamLeads(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/departments`, {
        headers: getAuthHeaders(),
      });
      setDepartments(data.departments || data || []);
    } catch (err) {
      console.error("Failed to load departments", err);
    }
  };

  useEffect(() => {
    fetchTeamLeads();
    fetchDepartments();
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "employee_type") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        position: "",
        department: "",
        team_lead_id: "",
      }));
    } else if (name === "position") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        department: "",
        team_lead_id: "",
      }));
    } else if (name === "country") {
      setFormData((prev) => ({
        ...prev,
        country: value,
        shift_type: value === "india" ? prev.shift_type : "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setFormError("");
  };

  const validateCreateForm = () => {
    if (!formData.first_name?.trim()) return "First name is required";
    if (!formData.last_name?.trim()) return "Last name is required";
    if (!formData.email?.trim()) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return "Invalid email address";
    if (!formData.country) return "Country is required";
    if (formData.country === "india" && !formData.shift_type)
      return "Shift is required for employees in India";
    if (!formData.hire_date) return "Hire date is required";
    if (formData.employee_type === "internal_team") {
      if (!formData.position) return "Position is required";
      if (shouldShowDepartment && !formData.department)
        return "Department is required";
      if (shouldShowTeamLead && !formData.team_lead_id)
        return "Team lead is required";
    }
    return null;
  };

  const handleCreateEmployee = async () => {
    const err = validateCreateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormLoading(true);
    setFormError("");
    try {
      const payload = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        country: formData.country,
        timezone: formData.timezone,
        shift_type: formData.country === "india" ? formData.shift_type : null,
        employee_type: formData.employee_type,
        hire_date: formData.hire_date,
      };
      if (formData.employee_type === "internal_team") {
        payload.position = formData.position;
        if (shouldShowDepartment) payload.department = formData.department;
        if (shouldShowTeamLead) payload.team_lead_id = formData.team_lead_id;
      }
      await axios.post(`${BACKEND_URL}/employees`, payload, {
        headers: getAuthHeaders(),
      });
      toast.success("Employee created successfully");
      setFormData(initialFormData);
      setViewMode("list");
      fetchEmployees();
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to create employee");
      toast.error(err.response?.data?.error || "Failed to create employee");
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      email: emp.user_id?.email,
      first_name: emp.user_id?.first_name || "",
      last_name: emp.user_id?.last_name || "",
      phone: emp.user_id?.phone || "",
      country: emp.user_id?.country || "",
      timezone: emp.user_id?.timezone || "",
      shift_type: emp.shift_type || "",
      employee_type: emp.employee_type || "internal_team",
      department: emp.department?._id || emp.department || "",
      position: emp.position || "",
      team_lead_id: emp.team_lead_id?._id || "",
      hire_date: emp.hire_date
        ? new Date(emp.hire_date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    });
    setFormError("");
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    const err = validateCreateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormLoading(true);
    setFormError("");
    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        country: formData.country,
        timezone: formData.timezone,
        shift_type: formData.country === "india" ? formData.shift_type : null,
        employee_type: formData.employee_type,
        department: formData.department || undefined,
        position: formData.position || undefined,
        team_lead_id: formData.team_lead_id || null,
        hire_date: formData.hire_date,
      };
      await axios.put(
        `${BACKEND_URL}/employees/${editingEmployee._id}`,
        payload,
        {
          headers: getAuthHeaders(),
        }
      );
      toast.success("Employee updated successfully");
      setEditingEmployee(null);
      setFormData(initialFormData);
      fetchEmployees();
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to update employee");
      toast.error(err.response?.data?.error || "Failed to update employee");
    } finally {
      setFormLoading(false);
    }
  };

  const openPasswordModal = (emp) => {
    setPasswordModalEmployee(emp);
    setPasswordResetMode("temp");
    setDirectPassword("");
    setPasswordResetLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!passwordModalEmployee) return;
    if (passwordResetMode === "direct") {
      if (!directPassword || directPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
    }
    setPasswordResetLoading(true);
    try {
      if (passwordResetMode === "temp") {
        await axios.post(
          `${BACKEND_URL}/employees/${passwordModalEmployee._id}/admin-reset-password`,
          {},
          { headers: getAuthHeaders() }
        );
        toast.success("Temporary password sent to employee email");
      } else {
        await axios.put(
          `${BACKEND_URL}/employees/${passwordModalEmployee._id}/admin-change-password`,
          { newPassword: directPassword },
          { headers: getAuthHeaders() }
        );
        toast.success("Password changed successfully");
      }
      setPasswordModalEmployee(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Password reset failed");
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleDeactivate = async (emp) => {
    try {
      await axios.delete(`${BACKEND_URL}/employees/${emp._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Employee deactivated");
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to deactivate");
    }
  };

  const labelClasses = "block text-sm font-medium mb-1.5";
  const inputClasses =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const selectClasses =
    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-14 w-full mb-6" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Employee Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage employee records, create new accounts, and handle password
            resets
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Badge variant="secondary">
            {totalEmployees} employee{totalEmployees !== 1 ? "s" : ""}
          </Badge>
          <Button
            onClick={() => {
              setViewMode("create");
              setFormData(initialFormData);
              setFormError("");
            }}
          >
            <UserPlus className="size-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {viewMode === "create" ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Add New Employee</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Fill in the details below. Credentials will be sent via email.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {formError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md p-3">
                <AlertCircle className="size-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleFormChange}
                  className={inputClasses}
                  placeholder="John"
                />
              </div>
              <div>
                <label className={labelClasses}>Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleFormChange}
                  className={inputClasses}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
                className={inputClasses}
                placeholder="john.doe@company.com"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  className={inputClasses}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className={labelClasses}>Country *</label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleFormChange}
                  className={selectClasses}
                >
                  <option value="">Select Country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {shouldShowShift && (
              <div>
                <label className={labelClasses}>Shift *</label>
                <select
                  name="shift_type"
                  value={formData.shift_type}
                  onChange={handleFormChange}
                  className={selectClasses}
                >
                  <option value="">Select Shift</option>
                  {SHIFT_OPTIONS.map((shift) => (
                    <option key={shift.value} value={shift.value}>
                      {shift.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  India employees must be assigned either day or night shift.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Timezone</label>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleFormChange}
                  className={selectClasses}
                >
                  <option value="">Select Timezone</option>
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Hire Date *</label>
                <input
                  type="date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleFormChange}
                  className={inputClasses}
                />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Employee Type *</label>
              <select
                name="employee_type"
                value={formData.employee_type}
                onChange={handleFormChange}
                className={selectClasses}
              >
                {EMPLOYEE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {shouldShowPosition && (
              <div>
                <label className={labelClasses}>Position *</label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleFormChange}
                  className={selectClasses}
                >
                  <option value="">Select Position</option>
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {shouldShowDepartment && (
              <div>
                <label className={labelClasses}>Department *</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleFormChange}
                  className={selectClasses}
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {shouldShowTeamLead && (
              <div>
                <label className={labelClasses}>Team Lead *</label>
                <select
                  name="team_lead_id"
                  value={formData.team_lead_id}
                  onChange={handleFormChange}
                  className={selectClasses}
                >
                  <option value="">Select Team Lead</option>
                  {teamLeads?.map((tl) => (
                    <option key={tl._id} value={tl._id}>
                      {tl.user_id?.first_name} {tl.user_id?.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleCreateEmployee}
                disabled={formLoading}
                className="flex-1"
              >
                {formLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4" />
                    Create Employee
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setViewMode("list");
                  setFormData(initialFormData);
                  setFormError("");
                }}
                disabled={formLoading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <Card className="mb-5">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 inset-y-0 my-auto size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className={selectClasses}
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterShift}
                  onChange={(e) => setFilterShift(e.target.value)}
                  className={selectClasses}
                >
                  <option value="all">All Shifts</option>
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {employees.length === 0 && !fetching ? (
            <Card className="p-12 text-center">
              <Users className="mx-auto size-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-medium mb-1">No employees found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your search or add a new employee
              </p>
              <Button onClick={() => setViewMode("create")}>
                <UserPlus className="size-4" />
                Add Employee
              </Button>
            </Card>
          ) : (
            <Card>
              <div className="overflow-hidden">
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-800/50">
                        <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Shift
                        </th>
                        <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Team Lead
                        </th>
                        <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Hire Date
                        </th>
                        <th className="px-5 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider w-24">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {employees.map((employee) => {
                        const fullName = `${employee.user_id?.first_name} ${employee.user_id?.last_name}`;
                        const teamLeadName = employee.team_lead_id
                          ? `${employee.team_lead_id.user_id?.first_name} ${employee.team_lead_id.user_id?.last_name}`
                          : "—";
                        const initials =
                          (employee.user_id?.first_name?.[0] || "") +
                          (employee.user_id?.last_name?.[0] || "");

                        return (
                          <tr
                            key={employee._id}
                            className="hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-zinc-700/80 flex items-center justify-center border border-zinc-600/50">
                                  <span className="text-zinc-300 font-medium text-xs">
                                    {initials}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-zinc-200">
                                    {fullName}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {employee.user_id?.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-700/60 text-zinc-300 border border-zinc-600/50">
                                {employee?.department?.name || "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm text-zinc-400">
                              {POSITION_LABELS[employee?.position] || employee?.position || "—"}
                            </td>
                            <td className="px-5 py-3 text-sm text-zinc-400">
                              {employee?.shift_type ? (
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                    SHIFT_BADGE_CLASSES[employee.shift_type] ||
                                    "border-zinc-700 bg-zinc-800 text-zinc-300"
                                  }`}
                                >
                                  {employee.shift_type === "night" ? "Night" : "Day"}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-5 py-3 text-sm text-zinc-400">
                              {teamLeadName}
                            </td>
                            <td className="px-5 py-3 text-sm text-zinc-400">
                              {employee?.hire_date
                                ? new Date(
                                    employee.hire_date
                                  ).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                  >
                                    <MoreVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openEditModal(employee)}
                                  >
                                    <Pencil className="size-3.5 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openPasswordModal(employee)}
                                  >
                                    <Key className="size-3.5 mr-2" />
                                    Reset Password
                                  </DropdownMenuItem>
                                  {employee?.is_active !== false && (
                                    <DropdownMenuItem
                                      onClick={() => handleDeactivate(employee)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      Deactivate
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-border">
                  {employees.map((employee) => {
                    const fullName = `${employee.user_id?.first_name} ${employee.user_id?.last_name}`;
                    const teamLeadName = employee.team_lead_id
                      ? `${employee.team_lead_id.user_id?.first_name} ${employee.team_lead_id.user_id?.last_name}`
                      : "—";

                    return (
                      <div
                        key={employee._id}
                        className="p-4 hover:bg-zinc-800/40"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-zinc-700/80 flex items-center justify-center border border-zinc-600/50">
                              <span className="text-zinc-300 font-medium text-xs">
                                {employee.user_id?.first_name?.[0]}
                                {employee.user_id?.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-zinc-200">
                                {fullName}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {employee.user_id?.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(employee)}
                              className="p-2 rounded-md text-zinc-400 hover:bg-zinc-700/50"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openPasswordModal(employee)}
                              className="p-2 rounded-md text-zinc-400 hover:bg-zinc-700/50"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-zinc-500">Department</span>
                            <p className="font-medium text-zinc-300">
                              {employee?.department?.name || "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500">Position</span>
                            <p className="font-medium text-zinc-300">
                              {employee?.position}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500">Shift</span>
                            <p className="font-medium text-zinc-300">
                              {employee?.shift_type ? (
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                    SHIFT_BADGE_CLASSES[employee.shift_type] ||
                                    "border-zinc-700 bg-zinc-800 text-zinc-300"
                                  }`}
                                >
                                  {employee.shift_type === "night" ? "Night" : "Day"}
                                </span>
                              ) : (
                                "—"
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500">Team Lead</span>
                            <p className="font-medium text-zinc-300">
                              {teamLeadName}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500">Hire Date</span>
                            <p className="font-medium text-zinc-300">
                              {employee?.hire_date
                                ? new Date(
                                    employee.hire_date
                                  ).toLocaleDateString()
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ─── Pagination ─── */}
              {totalEmployees > 0 && (
                <div className="px-5 py-3.5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>
                      {fetching ? (
                        <span className="text-zinc-500">Loading...</span>
                      ) : (
                        <>
                          Showing{" "}
                          <span className="font-medium text-zinc-300">
                            {(currentPage - 1) * itemsPerPage + 1}
                          </span>
                          –
                          <span className="font-medium text-zinc-300">
                            {Math.min(currentPage * itemsPerPage, totalEmployees)}
                          </span>
                          {" "}of{" "}
                          <span className="font-medium text-zinc-300">
                            {totalEmployees}
                          </span>
                        </>
                      )}
                    </span>
                    <div className="hidden sm:flex items-center gap-1.5">
                      <span className="text-zinc-600">|</span>
                      <span>Rows</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="h-7 rounded-md border border-zinc-700 bg-zinc-800/60 px-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      >
                        {[5, 10, 20, 50].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="size-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="First page"
                    >
                      <ChevronsLeft className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="size-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>

                    {getPageNumbers()[0] > 1 && (
                      <span className="size-8 flex items-center justify-center text-zinc-600 text-xs">...</span>
                    )}

                    {getPageNumbers().map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`size-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                          page === currentPage
                            ? "bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30"
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
                      <span className="size-8 flex items-center justify-center text-zinc-600 text-xs">...</span>
                    )}

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="size-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Next page"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="size-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Last page"
                    >
                      <ChevronsRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => {
              if (!formLoading) setEditingEmployee(null);
            }}
          />
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto border border-zinc-800 rounded-lg bg-zinc-900 shadow-xl">
            <div className="sticky top-0 px-5 py-4 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">
                Edit Employee
              </h2>
              <button
                onClick={() => !formLoading && setEditingEmployee(null)}
                className="p-2 rounded-md text-zinc-400 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {formError && (
                <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-700/50 rounded-md p-3">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-400">{formError}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleFormChange}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Last Name *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleFormChange}
                    className={inputClasses}
                  />
                </div>
              </div>
              <div>
                <label className={labelClasses}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className={`${inputClasses} opacity-60 cursor-not-allowed`}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Country *</label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleFormChange}
                    className={selectClasses}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {shouldShowShift && (
                <div>
                  <label className={labelClasses}>Shift *</label>
                  <select
                    name="shift_type"
                    value={formData.shift_type}
                    onChange={handleFormChange}
                    className={selectClasses}
                  >
                    <option value="">Select Shift</option>
                    {SHIFT_OPTIONS.map((shift) => (
                      <option key={shift.value} value={shift.value}>
                        {shift.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Timezone</label>
                  <select
                    name="timezone"
                    value={formData.timezone}
                    onChange={handleFormChange}
                    className={selectClasses}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Hire Date *</label>
                  <input
                    type="date"
                    name="hire_date"
                    value={formData.hire_date}
                    onChange={handleFormChange}
                    className={inputClasses}
                  />
                </div>
              </div>
              <div>
                <label className={labelClasses}>Employee Type</label>
                <select
                  name="employee_type"
                  value={formData.employee_type}
                  onChange={handleFormChange}
                  className={selectClasses}
                >
                  {EMPLOYEE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {shouldShowPosition && (
                <div>
                  <label className={labelClasses}>Position</label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleFormChange}
                    className={selectClasses}
                  >
                    {POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {shouldShowDepartment && (
                <div>
                  <label className={labelClasses}>Department</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleFormChange}
                    className={selectClasses}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {shouldShowTeamLead && (
                <div>
                  <label className={labelClasses}>Team Lead</label>
                  <select
                    name="team_lead_id"
                    value={formData.team_lead_id}
                    onChange={handleFormChange}
                    className={selectClasses}
                  >
                    <option value="">Select Team Lead</option>
                    {teamLeads?.map((tl) => (
                      <option key={tl._id} value={tl._id}>
                        {tl.user_id?.first_name} {tl.user_id?.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 px-5 py-4 border-t border-zinc-800 bg-zinc-900 flex gap-3">
              <button
                onClick={handleUpdateEmployee}
                disabled={formLoading}
                className="flex-1 py-2.5 px-4 rounded-md text-sm font-medium text-zinc-100 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {formLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
              <button
                onClick={() => !formLoading && setEditingEmployee(null)}
                className="px-4 py-2.5 border border-zinc-600 rounded-md text-sm font-medium text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordModalEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => {
              if (!passwordResetLoading) setPasswordModalEmployee(null);
            }}
          />
          <div className="relative w-full max-w-md border border-zinc-800 rounded-lg bg-zinc-900 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-800/50">
              <h2 className="text-sm font-semibold text-zinc-200">
                Reset Password
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {passwordModalEmployee.user_id?.first_name}{" "}
                {passwordModalEmployee.user_id?.last_name} —{" "}
                {passwordModalEmployee.user_id?.email}
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2 p-1 rounded-md bg-zinc-800/60 border border-zinc-700/50">
                <button
                  onClick={() => setPasswordResetMode("temp")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-colors ${
                    passwordResetMode === "temp"
                      ? "bg-zinc-700 text-zinc-100 border border-zinc-600"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Temp + Email
                </button>
                <button
                  onClick={() => setPasswordResetMode("direct")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium transition-colors ${
                    passwordResetMode === "direct"
                      ? "bg-zinc-700 text-zinc-100 border border-zinc-600"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Key className="w-4 h-4" />
                  Set Directly
                </button>
              </div>

              {passwordResetMode === "temp" ? (
                <div className="flex items-start gap-2 p-3 rounded-md bg-zinc-800/40 border border-zinc-700/50">
                  <Info className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-500">
                    A temporary password will be generated and sent to the
                    employee&apos;s email. They will be prompted to change it on
                    next login.
                  </p>
                </div>
              ) : (
                <div>
                  <label className={labelClasses}>New Password</label>
                  <input
                    type="password"
                    value={directPassword}
                    onChange={(e) => setDirectPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className={inputClasses}
                  />
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-900 flex gap-3">
              <button
                onClick={handlePasswordReset}
                disabled={
                  passwordResetLoading ||
                  (passwordResetMode === "direct" && directPassword.length < 8)
                }
                className="flex-1 py-2.5 px-4 rounded-md text-sm font-medium text-zinc-100 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {passwordResetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : passwordResetMode === "temp" ? (
                  "Send Temp Password"
                ) : (
                  "Change Password"
                )}
              </button>
              <button
                onClick={() =>
                  !passwordResetLoading && setPasswordModalEmployee(null)
                }
                className="px-4 py-2.5 border border-zinc-600 rounded-md text-sm font-medium text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

