import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  AlertCircle,
  Check,
  Search,
  Users,
  Lock,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
//import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const TABS = [
  { id: "roles", label: "Roles" },
  { id: "matrix", label: "Permission Matrix" },
  { id: "assignments", label: "Role Assignments" },
];

export default function RoleManagement() {
  const [activeTab, setActiveTab] = useState("roles");
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [allPermissionNames, setAllPermissionNames] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [userRolesMap, setUserRolesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    hierarchy_level: 10,
    description: "",
    permissions: [],
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [matrixSaving, setMatrixSaving] = useState(null);

  const fetchRoles = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/roles`, {
        headers: getAuthHeaders(),
      });
      setRoles(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/roles/permissions`, {
        headers: getAuthHeaders(),
      });
      setPermissions(data.grouped || {});
      setAllPermissionNames((data.permissions || []).map((p) => p.name));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/employees/`, {
        headers: getAuthHeaders(),
      });
      const empList = data.employees || [];
      setEmployees(empList);

      // Fetch roles for each employee
      const rolePromises = empList.map(async (emp) => {
        try {
          const { data: userRoles } = await axios.get(
            `${BACKEND_URL}/roles/user/${emp.user_id?._id}`,
            { headers: getAuthHeaders() }
          );
          return [emp.user_id?._id, userRoles];
        } catch {
          return [emp.user_id?._id, []];
        }
      });

      const results = await Promise.all(rolePromises);
      const map = {};
      for (const [userId, userRoles] of results) {
        if (userId) map[userId] = userRoles;
      }
      setUserRolesMap(map);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchRoles(), fetchPermissions()]);
      setLoading(false);
    };
    init();
  }, [fetchRoles, fetchPermissions]);

  useEffect(() => {
    if (activeTab === "assignments") {
      fetchEmployees();
    }
  }, [activeTab, fetchEmployees]);

  const openCreateModal = () => {
    setFormData({
      name: "",
      display_name: "",
      hierarchy_level: 10,
      description: "",
      permissions: [],
    });
    setFormError("");
    setShowCreateModal(true);
    setEditingRole(null);
  };

  const openEditModal = (role) => {
    setFormData({
      name: role.name,
      display_name: role.display_name,
      hierarchy_level: role.hierarchy_level,
      description: role.description || "",
      permissions: [...role.permissions],
    });
    setFormError("");
    setEditingRole(role);
    setShowCreateModal(true);
  };

  const handleSaveRole = async () => {
    if (!formData.display_name?.trim()) {
      setFormError("Display name is required");
      return;
    }
    if (!formData.name?.trim() && !editingRole) {
      setFormError("Role name is required");
      return;
    }
    setFormLoading(true);
    setFormError("");
    try {
      if (editingRole) {
        await axios.put(
          `${BACKEND_URL}/roles/${editingRole._id}`,
          {
            display_name: formData.display_name,
            hierarchy_level: formData.hierarchy_level,
            description: formData.description,
            permissions: formData.permissions,
          },
          { headers: getAuthHeaders() }
        );
        toast.success("Role updated");
      } else {
        await axios.post(
          `${BACKEND_URL}/roles`,
          formData,
          { headers: getAuthHeaders() }
        );
        toast.success("Role created");
      }
      setShowCreateModal(false);
      setEditingRole(null);
      fetchRoles();
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to save role");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (role.is_system) {
      toast.error("Cannot delete a system role");
      return;
    }
    try {
      await axios.delete(`${BACKEND_URL}/roles/${role._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Role deleted");
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete role");
    }
  };

  const togglePermissionInForm = (permName) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permName)
        ? prev.permissions.filter((p) => p !== permName)
        : [...prev.permissions, permName],
    }));
  };

  const handleMatrixToggle = async (role, permName) => {
    if (role.is_system && role.name === "super_admin") return;
    const newPerms = role.permissions.includes(permName)
      ? role.permissions.filter((p) => p !== permName)
      : [...role.permissions, permName];

    setMatrixSaving(`${role._id}-${permName}`);
    try {
      await axios.put(
        `${BACKEND_URL}/roles/${role._id}`,
        { permissions: newPerms },
        { headers: getAuthHeaders() }
      );
      setRoles((prev) =>
        prev.map((r) =>
          r._id === role._id ? { ...r, permissions: newPerms } : r
        )
      );
    } catch (err) {
      toast.error("Failed to update permission");
    } finally {
      setMatrixSaving(null);
    }
  };

  const handleAssignRole = async (userId, roleId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/roles/assign`,
        { user_id: userId, role_id: roleId },
        { headers: getAuthHeaders() }
      );
      toast.success("Role assigned");
      // Refresh that user's roles
      const { data: userRoles } = await axios.get(
        `${BACKEND_URL}/roles/user/${userId}`,
        { headers: getAuthHeaders() }
      );
      setUserRolesMap((prev) => ({ ...prev, [userId]: userRoles }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to assign role");
    }
  };

  const handleRemoveRole = async (userId, userRoleId) => {
    try {
      await axios.delete(`${BACKEND_URL}/roles/assign/${userRoleId}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Role removed");
      const { data: userRoles } = await axios.get(
        `${BACKEND_URL}/roles/user/${userId}`,
        { headers: getAuthHeaders() }
      );
      setUserRolesMap((prev) => ({ ...prev, [userId]: userRoles }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to remove role");
    }
  };

  const inputClasses =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const selectClasses =
    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";
  const labelClasses = "block text-sm font-medium mb-1.5";

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  const filteredEmployees = employees.filter((emp) => {
    if (!searchTerm) return true;
    const name = `${emp.user_id?.first_name} ${emp.user_id?.last_name}`.toLowerCase();
    const email = (emp.user_id?.email || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  const categoryNames = Object.keys(permissions).sort();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Roles & Access Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage roles, permissions, and access control
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {roles.length} role{roles.length !== 1 ? "s" : ""}
          </Badge>
          {activeTab === "roles" && (
            <Button onClick={openCreateModal}>
              <Plus className="size-4" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 mb-6 rounded-lg bg-zinc-800/50 border border-zinc-700/50 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-700 text-zinc-100 border border-zinc-600"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role) => (
            <Card key={role._id} className="relative group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {role.display_name}
                      {role.is_system && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          System
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {role.name}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    Level {role.hierarchy_level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {role.description && (
                  <p className="text-xs text-muted-foreground">
                    {role.description}
                  </p>
                )}
                <div>
                  <p className="text-xs text-zinc-500 mb-1.5">
                    {role.permissions.length} permission
                    {role.permissions.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 6).map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                      >
                        {perm}
                      </span>
                    ))}
                    {role.permissions.length > 6 && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-500">
                        +{role.permissions.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => openEditModal(role)}
                  >
                    <Pencil className="size-3 mr-1" />
                    Edit
                  </Button>
                  {!role.is_system && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteRole(role)}
                    >
                      <Trash2 className="size-3 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Permission Matrix Tab */}
      {activeTab === "matrix" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-900 z-10 min-w-[200px]">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role._id}
                      className="px-3 py-3 text-center font-medium text-zinc-500 uppercase tracking-wider min-w-[100px]"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{role.display_name}</span>
                        {role.is_system && (
                          <Lock className="size-2.5 text-zinc-600" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryNames.map((category) => (
                  <>
                    <tr key={`cat-${category}`} className="bg-zinc-800/30">
                      <td
                        colSpan={roles.length + 1}
                        className="px-4 py-2 font-semibold text-zinc-300 uppercase text-[11px] tracking-wider sticky left-0 bg-zinc-800/30 z-10"
                      >
                        {category}
                      </td>
                    </tr>
                    {permissions[category]?.map((perm) => (
                      <tr
                        key={perm.name}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/20"
                      >
                        <td className="px-4 py-2 sticky left-0 bg-zinc-900 z-10">
                          <div>
                            <span className="text-zinc-300 font-mono">
                              {perm.name}
                            </span>
                            <p className="text-zinc-600 text-[10px] mt-0.5">
                              {perm.description}
                            </p>
                          </div>
                        </td>
                        {roles.map((role) => {
                          const isChecked = role.permissions.includes(perm.name);
                          const isSuperAdmin = role.name === "super_admin";
                          const isSaving =
                            matrixSaving === `${role._id}-${perm.name}`;

                          return (
                            <td
                              key={role._id}
                              className="px-3 py-2 text-center"
                            >
                              <button
                                onClick={() =>
                                  !isSuperAdmin &&
                                  handleMatrixToggle(role, perm.name)
                                }
                                disabled={isSuperAdmin || isSaving}
                                className={`size-5 rounded border inline-flex items-center justify-center transition-colors ${
                                  isChecked
                                    ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400"
                                    : "border-zinc-700 text-transparent hover:border-zinc-500"
                                } ${
                                  isSuperAdmin
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                {isSaving ? (
                                  <Loader2 className="size-3 animate-spin text-zinc-400" />
                                ) : isChecked ? (
                                  <Check className="size-3" />
                                ) : null}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Role Assignments Tab */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/50">
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Assigned Roles
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-48">
                      Assign Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredEmployees.map((emp) => {
                    const userId = emp.user_id?._id;
                    const userRoles = userRolesMap[userId] || [];
                    const assignedRoleIds = userRoles.map(
                      (ur) => ur.role_id?._id
                    );
                    const availableRoles = roles.filter(
                      (r) => !assignedRoleIds.includes(r._id)
                    );

                    return (
                      <tr
                        key={emp._id}
                        className="hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div>
                            <p className="text-sm font-medium text-zinc-200">
                              {emp.user_id?.first_name} {emp.user_id?.last_name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {emp.user_id?.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-400">
                          {emp.position || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {userRoles.length === 0 && (
                              <span className="text-xs text-zinc-600">
                                No roles
                              </span>
                            )}
                            {userRoles.map((ur) => (
                              <span
                                key={ur._id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              >
                                {ur.role_id?.display_name || ur.role_id?.name}
                                <button
                                  onClick={() =>
                                    handleRemoveRole(userId, ur._id)
                                  }
                                  className="ml-0.5 hover:text-red-400"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {availableRoles.length > 0 && (
                            <select
                              className={selectClasses + " text-xs h-8"}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignRole(userId, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                            >
                              <option value="">Assign...</option>
                              {availableRoles.map((r) => (
                                <option key={r._id} value={r._id}>
                                  {r.display_name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Create/Edit Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => !formLoading && setShowCreateModal(false)}
          />
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto border border-zinc-800 rounded-lg bg-zinc-900 shadow-xl">
            <div className="sticky top-0 px-5 py-4 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between z-10">
              <h2 className="text-sm font-semibold text-zinc-200">
                {editingRole ? "Edit Role" : "Create Role"}
              </h2>
              <button
                onClick={() => !formLoading && setShowCreateModal(false)}
                className="p-2 rounded-md text-zinc-400 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {formError && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md p-3">
                  <AlertCircle className="size-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}
              {!editingRole && (
                <div>
                  <label className={labelClasses}>Role Name (slug) *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "_")
                          .replace(/[^a-z0-9_]/g, ""),
                      }))
                    }
                    className={inputClasses}
                    placeholder="e.g. security_auditor"
                  />
                </div>
              )}
              <div>
                <label className={labelClasses}>Display Name *</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      display_name: e.target.value,
                    }))
                  }
                  className={inputClasses}
                  placeholder="e.g. Security Auditor"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>Hierarchy Level *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.hierarchy_level}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        hierarchy_level: parseInt(e.target.value) || 1,
                      }))
                    }
                    className={inputClasses}
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Lower = higher privilege
                  </p>
                </div>
                <div>
                  <label className={labelClasses}>Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className={inputClasses}
                    placeholder="Brief description"
                  />
                </div>
              </div>

              {/* Permission checkboxes grouped by category */}
              <div>
                <label className={labelClasses}>
                  Permissions ({formData.permissions.length} selected)
                </label>
                <div className="max-h-64 overflow-y-auto border border-zinc-700/50 rounded-md p-3 space-y-3">
                  {categoryNames.map((category) => (
                    <div key={category}>
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                        {category}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {permissions[category]?.map((perm) => (
                          <label
                            key={perm.name}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(perm.name)}
                              onChange={() => togglePermissionInForm(perm.name)}
                              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/30"
                            />
                            <span className="text-xs text-zinc-300">
                              {perm.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 px-5 py-4 border-t border-zinc-800 bg-zinc-900 flex gap-3">
              <button
                onClick={handleSaveRole}
                disabled={formLoading}
                className="flex-1 py-2.5 px-4 rounded-md text-sm font-medium text-zinc-100 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {formLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : editingRole ? (
                  "Save Changes"
                ) : (
                  "Create Role"
                )}
              </button>
              <button
                onClick={() => !formLoading && setShowCreateModal(false)}
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
