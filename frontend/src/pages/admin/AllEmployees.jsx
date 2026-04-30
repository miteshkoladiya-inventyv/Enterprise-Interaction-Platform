import { useEffect, useState } from "react";
// import { BACKEND_URL } from "@/config"; 
import { BACKEND_URL } from "@/config.js";
import { Search, Users, Loader2 } from "lucide-react";

const AllEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  console.log({ employees });
  async function getAllEmployee() {
    const adminToken = localStorage.getItem("token");

    try {
      const response = await fetch(`${BACKEND_URL}/employees/`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await response.json();
      setEmployees(data.employees);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }

  useEffect(() => {
    getAllEmployee();
  }, []);

  const departments = [...new Map(employees.map((emp) => [emp.department?._id, emp.department]).filter(([id]) => id)).values()];

  const filteredEmployees = employees.filter((employee) => {
    const fullName =
      `${employee.user_id?.first_name} ${employee.user_id?.last_name}`.toLowerCase();
    const email = employee.user_id?.email.toLowerCase();
    const matchesSearch =
      fullName?.includes(searchTerm?.toLowerCase()) ||
      email?.includes(searchTerm?.toLowerCase());
    const matchesDepartment =
      filterDepartment === "all" || employee?.department?._id === filterDepartment;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && employee?.is_active) ||
      (filterStatus === "inactive" && !employee?.is_active);

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading employees...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white mb-1">Employees</h1>
          <p className="text-sm text-zinc-400">
            Manage and view all employees in your organization
          </p>
        </div>
        <span className="text-sm font-medium text-zinc-400 bg-zinc-800 px-3 py-1 rounded-full">
          {filteredEmployees.length} total
        </span>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 inset-y-0 my-auto h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-zinc-600 rounded-lg text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-500"
            />
          </div>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-300 bg-zinc-800"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </select>

          {/* <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-300 bg-zinc-800"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select> */}
        </div>
      </div>

      {/* Table */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
          <h3 className="text-sm font-medium text-white mb-1">
            No employees found
          </h3>
          <p className="text-sm text-zinc-400">
            Try adjusting your search or filter criteria
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Team Lead
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Hire Date
                  </th>
                  {/* <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Status
                  </th> */}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/30">
                {filteredEmployees.map((employee) => {
                  const fullName = `${employee.user_id?.first_name} ${employee.user_id?.last_name}`;
                  const teamLeadName = employee.team_lead_id
                    ? `${employee.team_lead_id.user_id?.first_name} ${employee.team_lead_id.user_id?.last_name}`
                    : "\u2014";

                  return (
                    <tr
                      key={employee._id}
                      className="hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                            <span className="text-indigo-400 font-medium text-xs">
                              {employee.user_id?.first_name[0]}
                              {employee.user_id?.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {fullName}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {employee.user_id?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300">
                          {employee?.department?.name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {employee?.position}
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {teamLeadName}
                      </td>
                      <td className="px-5 py-3 text-sm text-zinc-400">
                        {new Date(employee?.hire_date).toLocaleDateString()}
                      </td>
                      {/* <td className="px-5 py-3">
                        {employee?.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                            Inactive
                          </span>
                        )}
                      </td> */}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-zinc-700/30">
            {filteredEmployees.map((employee) => {
              const fullName = `${employee.user_id?.first_name} ${employee.user_id?.last_name}`;
              const teamLeadName = employee.team_lead_id
                ? `${employee.team_lead_id.user_id?.first_name} ${employee.team_lead_id.user_id?.last_name}`
                : "\u2014";

              return (
                <div
                  key={employee._id}
                  className="p-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <span className="text-indigo-400 font-medium text-xs">
                          {employee.user_id?.first_name[0]}
                          {employee.user_id?.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {fullName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {employee.user_id?.email}
                        </p>
                      </div>
                    </div>
                    {/* {employee?.is_active ? (
                      <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )} */}
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
                      <span className="text-zinc-500">Team Lead</span>
                      <p className="font-medium text-zinc-300">
                        {teamLeadName}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Hire Date</span>
                      <p className="font-medium text-zinc-300">
                        {new Date(employee.hire_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllEmployees;
