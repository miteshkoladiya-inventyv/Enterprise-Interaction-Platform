import { useEffect, useState } from "react";
import { UserPlus, AlertCircle, Loader2, Info } from "lucide-react";
//import { BACKEND_URL } from "@/config";
import { BACKEND_URL } from "@/config.js";
import axios from "axios";
import { toast } from "sonner";

const CreateEmployeePage = () => {
  const [teamLead, setTeamLead] = useState();
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    country: "",
    timezone: "",
    company_id: "",
    employee_type: "internal_team",
    department: "",
    position: "",
    team_lead_id: "",
    hire_date: new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const employeeTypes = [
    { value: "internal_team", label: "Internal Team" },
    { value: "customer_support", label: "Customer Support" },
  ];

  const departments = [
    { value: "frontend", label: "Frontend" },
    { value: "backend", label: "Backend" },
    { value: "devops", label: "DevOps" },
    { value: "qa", label: "QA" },
    { value: "hr", label: "HR" },
    { value: "finance", label: "Finance" },
  ];

  const country = [
    { value: "india", label: "India" },
    { value: "germany", label: "Germany" },
    { value: "usa", label: "USA" },
  ];

  const positions = [
    { value: "ceo", label: "CEO" },
    { value: "cto", label: "CTO" },
    { value: "team_lead", label: "Team Lead" },
    { value: "senior", label: "Senior" },
    { value: "mid", label: "Mid-Level" },
    { value: "junior", label: "Junior" },
  ];

  const timezones = [
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

  const positionsRequiringTeamLead = ["senior", "mid", "junior"];
  const shouldShowPosition = formData.employee_type === "internal_team";
  const shouldShowDepartment =
    formData.employee_type === "internal_team" &&
    formData.position &&
    ["team_lead", "senior", "mid", "junior"].includes(formData.position);
  const shouldShowTeamLead =
    formData.employee_type === "internal_team" &&
    formData.position &&
    positionsRequiringTeamLead.includes(formData.position);

  const handleChange = (e) => {
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
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    setError("");
  };

  // Helper function to find or create team group and add member
  const handleTeamGroupAssignment = async (
    newEmployeeId,
    teamLeadId,
    adminToken
  ) => {
    try {
      // Get the team lead's employee data
      const teamLeadResponse = await axios.get(
        `${BACKEND_URL}/employees/${teamLeadId}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );

      const teamLeadUserId =
        teamLeadResponse.data.user_id._id || teamLeadResponse.data.user_id;

      // Get all channels (using getUserChannels endpoint)
      const channelsResponse = await axios.get(`${BACKEND_URL}/api/chat`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { channel_type: "team" },
      });

      const channels = channelsResponse.data.channels || [];

      // Find existing team group created by this team lead
      let teamGroup = channels.find(
        (channel) =>
          channel.channel_type === "team" &&
          channel.created_by._id === teamLeadUserId
      );

      if (teamGroup) {
        // Team group exists, add the new employee to it
        console.log("Team group found, adding member:", teamGroup._id);

        await axios.post(
          `${BACKEND_URL}/api/chat/${teamGroup._id}/members`,
          { member_ids: [newEmployeeId] },
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        toast.success("Employee added to existing team group");
      } else {
        // No team group exists, create one
        console.log("No team group found, creating new one");

        const teamLeadInfo = teamLeadResponse.data;
        const groupName = `${teamLeadInfo.user_id.first_name} ${teamLeadInfo.user_id.last_name}'s Team`;

        // Create group using POST /api/chat endpoint
        const createGroupResponse = await axios.post(
          `${BACKEND_URL}/api/chat`,
          {
            channel_type: "team",
            name: groupName,
            department: formData.department,
            member_ids: [newEmployeeId], // New employee will be added as member
          },
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        toast.success("New team group created and employee added");
      }
    } catch (error) {
      console.error("Error handling team group assignment:", error);
      // Don't throw error - employee is created, group assignment is secondary
      toast.warning("Employee created but couldn't add to team group");
    }
  };

  const handleSubmit = async () => {
    if (!formData.first_name.trim()) {
      setError("Please enter the first name");
      return;
    }
    if (!formData.last_name.trim()) {
      setError("Please enter the last name");
      return;
    }
    if (!formData.email.trim()) {
      setError("Please enter the email address");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!formData.country) {
      setError("Please select a Country");
      return;
    }
    if (!formData.hire_date) {
      setError("Please select a hire date");
      return;
    }

    if (formData.employee_type === "internal_team") {
      if (!formData.position) {
        setError("Please select a position");
        return;
      }
      if (shouldShowDepartment && !formData.department) {
        setError("Please select a department");
        return;
      }
      if (shouldShowTeamLead && !formData.team_lead_id) {
        setError("Please select a team lead");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const adminToken = localStorage.getItem("token");

      const dataToSend = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        country: formData.country,
        timezone: formData.timezone,
        employee_type: formData.employee_type,
        hire_date: formData.hire_date,
      };

      if (formData.employee_type === "internal_team") {
        dataToSend.position = formData.position;
        if (shouldShowDepartment) dataToSend.department = formData.department;
        if (shouldShowTeamLead) dataToSend.team_lead_id = formData.team_lead_id;
      }

      const response = await axios.post(
        `${BACKEND_URL}/employees`,
        dataToSend,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      // If employee has a team lead, handle team group assignment
      if (formData.team_lead_id && response.data.user_id) {
        await handleTeamGroupAssignment(
          response.data.user_id,
          formData.team_lead_id,
          adminToken
        );
      }

      setFormData({
        email: "",
        first_name: "",
        last_name: "",
        phone: "",
        country: "",
        timezone: "",
        company_id: "",
        employee_type: "internal_team",
        department: "",
        position: "",
        team_lead_id: "",
        hire_date: new Date().toISOString().split("T")[0],
      });
      toast.success("Employee Created Successfully");
      setLoading(false);
    } catch (error) {
      if (error.response) {
        setError(error.response.data.error || "Failed to create employee");
      } else if (error.request) {
        setError("Server not responding. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      email: "",
      first_name: "",
      last_name: "",
      phone: "",
      country: "",
      timezone: "",
      company_id: "",
      employee_type: "internal_team",
      department: "",
      position: "",
      team_lead_id: "",
      hire_date: new Date().toISOString().split("T")[0],
    });
    setError("");
  };

  useEffect(() => {
    const getTeamLead = async () => {
      try {
        const adminToken = localStorage.getItem("token");
        const response = await axios.get(`${BACKEND_URL}/helper/getTeamLead`, {
          headers: { authorization: `Bearer ${adminToken}` },
        });
        setTeamLead(response.data.data);
      } catch (error) {
        console.error(error);
      }
    };
    getTeamLead();
  }, []);

  const inputClasses =
    "w-full px-3 py-2 border border-zinc-600 rounded-lg text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-zinc-500 transition";
  const selectClasses =
    "w-full px-3 py-2 border border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-zinc-800 text-zinc-300 transition appearance-none cursor-pointer";
  const labelClasses = "block text-sm font-medium text-zinc-300 mb-1.5";

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">
          Create Employee
        </h1>
        <p className="text-sm text-zinc-400">
          Add a new team member to your organization
        </p>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50">
        <div className="p-5 lg:p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>First Name *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
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
                onChange={handleChange}
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
              onChange={handleChange}
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
                onChange={handleChange}
                className={inputClasses}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div>
              <label className={labelClasses}>Country *</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="">Select Country</option>
                {country.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Timezone</label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="">Select Timezone</option>
                {timezones.map((tz) => (
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
                onChange={handleChange}
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label className={labelClasses}>Employee Type *</label>
            <select
              name="employee_type"
              value={formData.employee_type}
              onChange={handleChange}
              className={selectClasses}
            >
              {employeeTypes.map((t) => (
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
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="">Select Position</option>
                {positions.map((p) => (
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
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
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
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="">Select Team Lead</option>
                {teamLead?.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.user_id.first_name} {d.user_id.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Employee
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={loading}
              className="px-4 py-2.5 border border-zinc-600 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Info Footer */}
        <div className="bg-zinc-800/50 border-t border-zinc-700/50 p-5 rounded-b-xl">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-500">
              <p className="font-medium text-zinc-400 mb-1">
                What happens next?
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>User account created with provided credentials</li>
                <li>Employee record linked to user account</li>
                <li>
                  If team lead assigned, employee joins team group automatically
                </li>
                <li>Access permissions set based on position & department</li>
                <li>Employee must change password on first login</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEmployeePage;
