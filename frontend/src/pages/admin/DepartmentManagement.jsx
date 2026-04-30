import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  ChevronRight,
  ChevronDown,
  UserCircle,
  Loader2,
  AlertCircle,
  Network,
  List,
  X,
  GitBranchPlus,
  Crown,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BACKEND_URL } from "@/config";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#64748b", "#a855f7",
];

const initialForm = {
  name: "",
  code: "",
  description: "",
  head_id: "",
  parent_department_id: "",
  color: "#6366f1",
  type: "department",
};

// ─── Org Tree Node ───
function OrgTreeNode({ node, depth = 0, isLast = false }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const headUser = node.head_id?.user_id;
  const color = node.color || "#6366f1";
  const memberCount = node.members?.length || 0;
  const isTeam = node.type === "team";

  return (
    <div className="relative">
      {/* ─── Connector lines (for child nodes) ─── */}
      {depth > 0 && (
        <>
          {/* Vertical line from parent down */}
          <div
            className="absolute left-0 top-0 w-px bg-zinc-700/50"
            style={{
              left: -20,
              height: isLast ? 28 : "100%",
            }}
          />
          {/* Horizontal branch to node */}
          <div
            className="absolute bg-zinc-700/50"
            style={{
              left: -20,
              top: 28,
              width: 20,
              height: 1,
            }}
          />
        </>
      )}

      {/* ─── Node card ─── */}
      <div
        className="group relative flex items-start gap-3 py-2.5 px-3.5 rounded-xl border border-transparent hover:border-zinc-800 hover:bg-zinc-800/30 transition-all cursor-pointer mb-1"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Color accent + expand toggle */}
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
          <div
            className="size-8 rounded-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
          >
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="size-3.5" style={{ color }} />
              ) : (
                <ChevronRight className="size-3.5" style={{ color }} />
              )
            ) : isTeam ? (
              <Users className="size-3.5" style={{ color }} />
            ) : (
              <Building2 className="size-3.5" style={{ color }} />
            )}
          </div>
          {/* Vertical stem down to children */}
          {hasChildren && expanded && (
            <div
              className="w-px flex-1 min-h-[8px] bg-zinc-700/50"
            />
          )}
        </div>

        {/* Dept info */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-200 leading-tight">
              {node.name}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}12`, color: `${color}cc` }}>
              {node.code}
            </span>
            {isTeam && (
              <Badge variant="secondary" className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20 py-0">
                Team
              </Badge>
            )}
            {!node.is_active && (
              <Badge variant="secondary" className="text-[9px] bg-zinc-800 text-zinc-500 border-zinc-700 py-0">
                Inactive
              </Badge>
            )}
          </div>

          {/* Head + member count row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {headUser ? (
              <div className="flex items-center gap-1.5">
                <Avatar className="size-5 ring-1 ring-zinc-800">
                  <AvatarImage src={headUser.profile_picture} />
                  <AvatarFallback className="text-[8px] bg-zinc-700 text-zinc-300">
                    {headUser.first_name?.[0]}{headUser.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-zinc-400">
                  {headUser.first_name} {headUser.last_name}
                </span>
                <Crown className="size-3 text-amber-500/60" />
              </div>
            ) : (
              <span className="text-[10px] text-zinc-600 italic">
                No {isTeam ? "lead" : "head"}
              </span>
            )}

            {memberCount > 0 && (
              <div className="flex items-center gap-1">
                <Users className="size-3 text-zinc-600" />
                <span className="text-[10px] text-zinc-500 font-medium">
                  {memberCount}
                </span>
              </div>
            )}

            {hasChildren && (
              <div className="flex items-center gap-1">
                <GitBranchPlus className="size-3 text-zinc-600" />
                <span className="text-[10px] text-zinc-500 font-medium">
                  {node.children.length} {node.children.length === 1 ? "team" : "teams"}
                </span>
              </div>
            )}
          </div>

          {/* Members avatars */}
          {memberCount > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex -space-x-1.5">
                {node.members.slice(0, 6).map((m) => (
                  <Avatar key={m._id} className="size-5 ring-1 ring-zinc-900">
                    <AvatarImage src={m.user_id?.profile_picture} />
                    <AvatarFallback className="text-[7px] bg-zinc-700/80 text-zinc-400">
                      {m.user_id?.first_name?.[0]}{m.user_id?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {memberCount > 6 && (
                <span className="text-[10px] text-zinc-600">
                  +{memberCount - 6}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Children ─── */}
      {hasChildren && expanded && (
        <div className="relative ml-[18px] pl-[22px]">
          {node.children.map((child, idx) => (
            <OrgTreeNode
              key={child._id}
              node={child}
              depth={depth + 1}
              isLast={idx === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [orgTree, setOrgTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" | "tree"

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Detail drawer
  const [detailDept, setDetailDept] = useState(null);
  const [detailEmployees, setDetailEmployees] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ─── Fetch ───
  const fetchDepartments = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/departments`, {
        headers: getAuthHeaders(),
      });
      setDepartments(data.departments || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/employees/`, {
        headers: getAuthHeaders(),
      });
      setEmployees(data.employees || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchOrgTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/departments/org-tree`, {
        headers: getAuthHeaders(),
      });
      setOrgTree(data.tree || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load org tree");
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, [fetchDepartments, fetchEmployees]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDepartments(), fetchEmployees()]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (viewMode === "tree") fetchOrgTree();
  }, [viewMode, fetchOrgTree]);

  // ─── Filtered ───
  const filteredDepartments = useMemo(() => {
    if (!searchTerm) return departments;
    const q = searchTerm.toLowerCase();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q)
    );
  }, [departments, searchTerm]);

  // Stats
  const totalMembers = useMemo(
    () => departments.reduce((sum, d) => sum + (d.employee_count || 0), 0),
    [departments]
  );
  const deptCount = useMemo(
    () => departments.filter((d) => d.is_active && d.type !== "team").length,
    [departments]
  );
  const teamCount = useMemo(
    () => departments.filter((d) => d.is_active && d.type === "team").length,
    [departments]
  );
  const withHeads = useMemo(
    () => departments.filter((d) => d.head_id).length,
    [departments]
  );

  // Only departments (not teams) for the parent picker
  const parentOptions = useMemo(
    () => departments.filter((d) => d.type !== "team"),
    [departments]
  );

  // ─── CRUD ───
  const openCreateDialog = (type = "department") => {
    setEditingDept(null);
    setFormData({ ...initialForm, type });
    setFormError("");
    setDialogOpen(true);
  };

  const openEditDialog = (dept) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
      head_id: dept.head_id?._id || "",
      parent_department_id:
        dept.parent_department_id?._id || dept.parent_department_id || "",
      color: dept.color || "#6366f1",
      type: dept.type || "department",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const isTeam = formData.type === "team";
    const label = isTeam ? "Team" : "Department";

    if (!formData.name?.trim()) {
      setFormError(`${label} name is required`);
      return;
    }
    if (!formData.code?.trim()) {
      setFormError(`${label} code is required`);
      return;
    }
    if (isTeam && !formData.parent_department_id) {
      setFormError("Teams must belong to a parent department");
      return;
    }

    setFormLoading(true);
    setFormError("");
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        description: formData.description.trim(),
        head_id: formData.head_id || null,
        parent_department_id: formData.parent_department_id || null,
        color: formData.color,
        type: formData.type,
      };

      if (editingDept) {
        await axios.put(
          `${BACKEND_URL}/departments/${editingDept._id}`,
          payload,
          { headers: getAuthHeaders() }
        );
        toast.success(`${label} updated`);
      } else {
        await axios.post(`${BACKEND_URL}/departments`, payload, {
          headers: getAuthHeaders(),
        });
        toast.success(`${label} created`);
      }

      setDialogOpen(false);
      setEditingDept(null);
      setFormData(initialForm);
      fetchDepartments();
      if (viewMode === "tree") fetchOrgTree();
    } catch (err) {
      setFormError(err.response?.data?.error || "Operation failed");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${BACKEND_URL}/departments/${deleteTarget._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success(`${deleteTarget.type === "team" ? "Team" : "Department"} deleted`);
      setDeleteTarget(null);
      fetchDepartments();
      if (viewMode === "tree") fetchOrgTree();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDetail = async (dept) => {
    setDetailDept(dept);
    setDetailLoading(true);
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/departments/${dept._id}`,
        { headers: getAuthHeaders() }
      );
      setDetailDept(data.department);
      setDetailEmployees(data.employees || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Render ───
  const labelClasses = "block text-xs font-medium text-zinc-400 mb-1.5";
  const inputClasses =
    "flex h-9 w-full rounded-lg border border-zinc-700/80 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors";
  const selectClasses =
    "flex h-9 w-full items-center justify-between rounded-lg border border-zinc-700/80 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors";

  const isFormTeam = formData.type === "team";
  const formLabel = isFormTeam ? "Team" : "Department";

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-7 w-56 mb-2" />
        <Skeleton className="h-4 w-72 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Department Management
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manage departments and teams, assign heads, and view organizational hierarchy
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          {/* View toggle */}
          <div className="flex items-center bg-zinc-800/60 border border-zinc-700/60 rounded-lg p-0.5">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-indigo-500/15 text-indigo-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-300"
              }`}
              onClick={() => setViewMode("list")}
            >
              <List className="size-3.5" />
              List
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "tree"
                  ? "bg-indigo-500/15 text-indigo-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-300"
              }`}
              onClick={() => setViewMode("tree")}
            >
              <Network className="size-3.5" />
              Org Tree
            </button>
          </div>
          <Button
            onClick={() => openCreateDialog("team")}
            variant="outline"
            className="gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
          >
            <Users className="size-4" />
            New Team
          </Button>
          <Button
            onClick={() => openCreateDialog("department")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 shadow-lg shadow-indigo-500/10"
          >
            <Plus className="size-4" />
            New Department
          </Button>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Departments
              </p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">
                {deptCount}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Building2 className="size-5 text-indigo-400" />
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Teams
              </p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">
                {teamCount}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Users className="size-5 text-cyan-400" />
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Total Members
              </p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">
                {totalMembers}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <UserCircle className="size-5 text-emerald-400" />
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                With Heads
              </p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">
                {withHeads}
                <span className="text-sm text-zinc-500 font-normal ml-1">
                  / {deptCount + teamCount}
                </span>
              </p>
            </div>
            <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Crown className="size-5 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      {viewMode === "list" ? (
        <>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
              <Input
                placeholder="Search departments & teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-zinc-900/60 border-zinc-800/80 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Department Cards */}
          {filteredDepartments.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-12 text-center">
              <Building2 className="mx-auto size-10 text-zinc-700 mb-3" />
              <h3 className="text-sm font-medium text-zinc-300 mb-1">
                {searchTerm ? "No results match your search" : "No departments yet"}
              </h3>
              <p className="text-sm text-zinc-600 mb-4">
                {searchTerm
                  ? "Try a different search term"
                  : "Create your first department to get started"}
              </p>
              {!searchTerm && (
                <Button onClick={() => openCreateDialog("department")} className="bg-indigo-600 hover:bg-indigo-500 text-white border-0">
                  <Plus className="size-4" />
                  Create Department
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDepartments.map((dept) => {
                const headUser = dept.head_id?.user_id;
                const headName = headUser
                  ? `${headUser.first_name} ${headUser.last_name}`
                  : null;
                const headInitials = headUser
                  ? `${headUser.first_name?.[0] || ""}${headUser.last_name?.[0] || ""}`
                  : "";
                const parentName = dept.parent_department_id?.name;
                const isTeam = dept.type === "team";

                return (
                  <div
                    key={dept._id}
                    className="group bg-zinc-900/60 border border-zinc-800/80 rounded-xl hover:border-zinc-700/80 transition-all cursor-pointer overflow-hidden"
                    onClick={() => openDetail(dept)}
                  >
                    {/* Color bar */}
                    <div
                      className="h-1"
                      style={{ backgroundColor: dept.color || "#6366f1" }}
                    />

                    <div className="p-4">
                      {/* Top row: name + actions */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="size-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: `${dept.color || "#6366f1"}15`,
                            }}
                          >
                            {isTeam ? (
                              <Users
                                className="size-4"
                                style={{ color: dept.color || "#6366f1" }}
                              />
                            ) : (
                              <Building2
                                className="size-4"
                                style={{ color: dept.color || "#6366f1" }}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-semibold text-zinc-200 truncate">
                                {dept.name}
                              </h3>
                              {isTeam && (
                                <Badge variant="secondary" className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20 py-0 px-1.5 flex-shrink-0">
                                  Team
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-600">
                              {dept.code}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(dept);
                            }}
                            className="size-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(dept);
                            }}
                            className="size-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {dept.description && (
                        <p className="text-xs text-zinc-500 mb-3 line-clamp-2">
                          {dept.description}
                        </p>
                      )}

                      {/* Head */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {headUser ? (
                            <>
                              <Avatar className="size-6 ring-1 ring-zinc-800">
                                <AvatarImage src={headUser.profile_picture} />
                                <AvatarFallback className="text-[9px] bg-zinc-700 text-zinc-300">
                                  {headInitials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs text-zinc-300 font-medium leading-none">
                                  {headName}
                                </p>
                                <p className="text-[10px] text-zinc-600 mt-0.5">
                                  {isTeam ? "Team Lead" : "Department Head"}
                                </p>
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-zinc-600 italic">
                              No {isTeam ? "lead" : "head"} assigned
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Users className="size-3 text-zinc-600" />
                          <span className="text-xs font-medium text-zinc-400">
                            {dept.employee_count || 0}
                          </span>
                        </div>
                      </div>

                      {/* Parent tag */}
                      {parentName && (
                        <div className="mt-2.5 pt-2.5 border-t border-zinc-800/60">
                          <div className="flex items-center gap-1.5">
                            <GitBranchPlus className="size-3 text-zinc-600" />
                            <span className="text-[10px] text-zinc-500">
                              {isTeam ? "Department" : "Parent"}: {parentName}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        // ─── Org Tree View ───
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Network className="size-4 text-indigo-400" />
              Organizational Hierarchy
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Departments and their teams
            </p>
          </div>

          <div className="p-4">
            {treeLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg ml-6" />
                <Skeleton className="h-16 w-full rounded-lg ml-6" />
                <Skeleton className="h-16 w-full rounded-lg ml-12" />
              </div>
            ) : orgTree.length === 0 ? (
              <div className="text-center py-12">
                <Network className="mx-auto size-10 text-zinc-700 mb-3" />
                <h3 className="text-sm font-medium text-zinc-300 mb-1">
                  No hierarchy data
                </h3>
                <p className="text-sm text-zinc-600">
                  Create departments and add teams to build the org tree
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {orgTree.map((node, idx) => (
                  <OrgTreeNode key={node._id} node={node} isLast={idx === orgTree.length - 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editingDept ? `Edit ${formLabel}` : `Create ${formLabel}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{formError}</p>
              </div>
            )}

            {/* Type toggle */}
            <div>
              <label className={labelClasses}>Type</label>
              <div className="flex items-center bg-zinc-800/60 border border-zinc-700/60 rounded-lg p-0.5 w-fit">
                <button
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    !isFormTeam
                      ? "bg-indigo-500/15 text-indigo-400 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-300"
                  }`}
                  onClick={() => setFormData((p) => ({ ...p, type: "department", parent_department_id: "" }))}
                >
                  <Building2 className="size-3.5" />
                  Department
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isFormTeam
                      ? "bg-cyan-500/15 text-cyan-400 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-300"
                  }`}
                  onClick={() => setFormData((p) => ({ ...p, type: "team" }))}
                >
                  <Users className="size-3.5" />
                  Team
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>{formLabel} Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  className={inputClasses}
                  placeholder={isFormTeam ? "iOS Team" : "Mobile Development"}
                />
              </div>
              <div>
                <label className={labelClasses}>Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  className={inputClasses}
                  placeholder={isFormTeam ? "IOS" : "MOBILEDEV"}
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <label className={labelClasses}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                className={`${inputClasses} h-20 resize-none`}
                placeholder={isFormTeam ? "What does this team do?" : "What does this department do?"}
              />
            </div>

            <div>
              <label className={labelClasses}>{isFormTeam ? "Team Lead" : "Department Head"}</label>
              <select
                value={formData.head_id}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, head_id: e.target.value }))
                }
                className={selectClasses}
              >
                <option value="">No {isFormTeam ? "lead" : "head"} assigned</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.user_id?.first_name} {emp.user_id?.last_name}
                    {emp.position ? ` — ${emp.position}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>
                Parent Department {isFormTeam && <span className="text-red-400">*</span>}
              </label>
              <select
                value={formData.parent_department_id}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    parent_department_id: e.target.value,
                  }))
                }
                className={selectClasses}
              >
                <option value="">{isFormTeam ? "Select parent department..." : "None (Root department)"}</option>
                {parentOptions
                  .filter((d) => d._id !== editingDept?._id)
                  .map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFormData((p) => ({ ...p, color: c }))}
                    className={`size-7 rounded-lg border-2 transition-all ${
                      formData.color === c
                        ? "border-white scale-110"
                        : "border-transparent hover:border-zinc-600"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={formLoading}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={formLoading}
              className={isFormTeam
                ? "bg-cyan-600 hover:bg-cyan-500 text-white border-0"
                : "bg-indigo-600 hover:bg-indigo-500 text-white border-0"
              }
            >
              {formLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : editingDept ? (
                `Update ${formLabel}`
              ) : (
                `Create ${formLabel}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Delete {deleteTarget?.type === "team" ? "Team" : "Department"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-zinc-200">
              {deleteTarget?.name}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-500 text-white border-0"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Department Detail Drawer ─── */}
      <Dialog
        open={!!detailDept}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDept(null);
            setDetailEmployees([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <div
                className="size-5 rounded flex items-center justify-center"
                style={{
                  backgroundColor: `${detailDept?.color || "#6366f1"}20`,
                }}
              >
                {detailDept?.type === "team" ? (
                  <Users
                    className="size-3"
                    style={{ color: detailDept?.color || "#6366f1" }}
                  />
                ) : (
                  <Building2
                    className="size-3"
                    style={{ color: detailDept?.color || "#6366f1" }}
                  />
                )}
              </div>
              {detailDept?.name}
              <span className="text-xs font-mono text-zinc-600 font-normal">
                {detailDept?.code}
              </span>
              {detailDept?.type === "team" && (
                <Badge variant="secondary" className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20 py-0">
                  Team
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Description */}
              {detailDept?.description && (
                <p className="text-sm text-zinc-400">
                  {detailDept.description}
                </p>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/40 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">
                    {detailDept?.type === "team" ? "Lead" : "Head"}
                  </p>
                  {detailDept?.head_id?.user_id ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage
                          src={detailDept.head_id.user_id.profile_picture}
                        />
                        <AvatarFallback className="text-[9px] bg-zinc-700 text-zinc-300">
                          {detailDept.head_id.user_id.first_name?.[0]}
                          {detailDept.head_id.user_id.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-zinc-200">
                        {detailDept.head_id.user_id.first_name}{" "}
                        {detailDept.head_id.user_id.last_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-500 italic">
                      Not assigned
                    </span>
                  )}
                </div>
                <div className="bg-zinc-800/40 rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">
                    {detailDept?.type === "team" ? "Department" : "Parent"}
                  </p>
                  <span className="text-sm text-zinc-200">
                    {detailDept?.parent_department_id?.name || "Root"}
                  </span>
                </div>
              </div>

              {/* Children */}
              {detailDept?.children && detailDept.children.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-2">
                    Teams
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detailDept.children.map((child) => (
                      <Badge
                        key={child._id}
                        variant="secondary"
                        className="bg-zinc-800 text-zinc-300 border-zinc-700 text-xs"
                      >
                        {child.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Members table */}
              <div>
                <p className="text-xs font-semibold text-zinc-400 mb-2">
                  Members ({detailEmployees.length})
                </p>
                {detailEmployees.length === 0 ? (
                  <p className="text-sm text-zinc-600 italic py-4 text-center">
                    No employees in this {detailDept?.type === "team" ? "team" : "department"}
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-800/60">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-800/40">
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Employee
                          </th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Position
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {detailEmployees.map((emp) => {
                          const name = `${emp.user_id?.first_name || ""} ${emp.user_id?.last_name || ""}`;
                          const initials = `${emp.user_id?.first_name?.[0] || ""}${emp.user_id?.last_name?.[0] || ""}`;
                          return (
                            <tr
                              key={emp._id}
                              className="hover:bg-zinc-800/20"
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="size-6">
                                    <AvatarImage
                                      src={emp.user_id?.profile_picture}
                                    />
                                    <AvatarFallback className="text-[9px] bg-zinc-700 text-zinc-300">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-xs font-medium text-zinc-200">
                                      {name}
                                    </p>
                                    <p className="text-[10px] text-zinc-500">
                                      {emp.user_id?.email}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs text-zinc-400">
                                  {emp.position || "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => openEditDialog(detailDept)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
