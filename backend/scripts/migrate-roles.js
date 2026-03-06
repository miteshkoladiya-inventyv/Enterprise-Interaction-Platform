import "../env.js";
import mongoose from "mongoose";
import Permission from "../models/Permission.js";
import Role from "../models/Role.js";
import { UserRole } from "../models/UserRole.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import Department from "../models/Department.js";

const PERMISSIONS = [
  // employees
  { name: "employees:read", description: "View employee list and profiles", category: "employees" },
  { name: "employees:create", description: "Create new employee accounts", category: "employees" },
  { name: "employees:update", description: "Edit employee details", category: "employees" },
  { name: "employees:delete", description: "Deactivate/delete employees", category: "employees" },
  { name: "employees:reset_password", description: "Reset employee passwords", category: "employees" },
  // departments
  { name: "departments:read", description: "View department structure", category: "departments" },
  { name: "departments:create", description: "Create departments", category: "departments" },
  { name: "departments:update", description: "Edit department details", category: "departments" },
  { name: "departments:delete", description: "Delete departments", category: "departments" },
  // chat
  { name: "chat:read", description: "Read channel messages", category: "chat" },
  { name: "chat:send", description: "Send channel messages", category: "chat" },
  { name: "chat:manage_channels", description: "Create/archive/delete channels", category: "chat" },
  { name: "chat:manage_messages", description: "Delete any message (moderation)", category: "chat" },
  // meetings
  { name: "meetings:read", description: "View meetings", category: "meetings" },
  { name: "meetings:create", description: "Create meetings", category: "meetings" },
  { name: "meetings:manage", description: "Edit/cancel any meeting", category: "meetings" },

  // leave
  { name: "leave:read_own", description: "View own leave requests", category: "leave" },
  { name: "leave:read_all", description: "View all leave requests", category: "leave" },
  { name: "leave:approve", description: "Approve/reject leave requests", category: "leave" },
  { name: "leave:manage", description: "Create/edit leave policies", category: "leave" },
  // tickets
  { name: "tickets:read", description: "View support tickets", category: "tickets" },
  { name: "tickets:create", description: "Create tickets", category: "tickets" },
  { name: "tickets:assign", description: "Assign tickets to employees", category: "tickets" },
  { name: "tickets:manage", description: "Close/delete/manage all tickets", category: "tickets" },
  // analytics
  { name: "analytics:view", description: "View analytics dashboard", category: "analytics" },
  { name: "analytics:export", description: "Export analytics data", category: "analytics" },
  // roles
  { name: "roles:read", description: "View roles and permissions", category: "roles" },
  { name: "roles:create", description: "Create new roles", category: "roles" },
  { name: "roles:update", description: "Edit roles and their permissions", category: "roles" },
  { name: "roles:delete", description: "Delete non-system roles", category: "roles" },
  { name: "roles:assign", description: "Assign roles to employees", category: "roles" },
  // ai
  { name: "ai:use", description: "Use AI assistant", category: "ai" },
];

const ALL_PERMISSION_NAMES = PERMISSIONS.map((p) => p.name);

const DEFAULT_ROLES = [
  {
    name: "super_admin",
    display_name: "Super Admin",
    hierarchy_level: 1,
    permissions: ALL_PERMISSION_NAMES,
    description: "Full system access",
    is_system: true,
  },
  {
    name: "hr_admin",
    display_name: "HR Admin",
    hierarchy_level: 2,
    permissions: [
      "employees:read", "employees:create", "employees:update", "employees:delete", "employees:reset_password",
      "departments:read", "departments:create", "departments:update", "departments:delete",

      "leave:read_own", "leave:read_all", "leave:approve", "leave:manage",
      "analytics:view",
      "roles:read", "roles:assign",
      "chat:read", "chat:send",
      "meetings:read", "meetings:create",
      "ai:use",
    ],
    description: "HR and employee management access",
    is_system: true,
  },
  {
    name: "team_lead",
    display_name: "Team Lead",
    hierarchy_level: 3,
    permissions: [
      "employees:read",
      "departments:read",
      "leave:read_own", "leave:read_all", "leave:approve",
      "meetings:read", "meetings:create", "meetings:manage",
      "chat:read", "chat:send",
      "tickets:read",
      "analytics:view",
      "ai:use",
    ],
    description: "Team management and oversight access",
    is_system: true,
  },
  {
    name: "employee",
    display_name: "Employee",
    hierarchy_level: 4,
    permissions: [
      "employees:read",
      "departments:read",
      "leave:read_own",
      "meetings:read", "meetings:create",
      "chat:read", "chat:send",
      "tickets:create",
      "ai:use",
    ],
    description: "Standard employee access",
    is_system: true,
  },
  {
    name: "read_only",
    display_name: "Read Only",
    hierarchy_level: 5,
    permissions: [
      "employees:read",
      "departments:read",
      "analytics:view",
    ],
    description: "View-only access to basic information",
    is_system: true,
  },
  {
    name: "customer_support",
    display_name: "Customer Support",
    hierarchy_level: 6,
    permissions: [
      "tickets:read", "tickets:create", "tickets:assign", "tickets:manage",
      "chat:read", "chat:send",
      "leave:read_own",
      "ai:use",
    ],
    description: "Customer support ticket management",
    is_system: true,
  },
];

const DEPARTMENTS_TO_SEED = [
  { name: "Administration", code: "ADM", color: "#6366f1" },
  { name: "HR", code: "HR", color: "#8b5cf6" },
  { name: "DevOps", code: "DEVOPS", color: "#06b6d4" },
  { name: "Cybersecurity", code: "SEC", color: "#ef4444" },
  { name: "Web Development", code: "WEBDEV", color: "#3b82f6" },
  { name: "Mobile Development", code: "MOBILEDEV", color: "#10b981" },
  { name: "Tax Analyst", code: "TAX", color: "#f59e0b" },
  { name: "Staff", code: "STAFF", color: "#64748b" },
  { name: "Customer Support", code: "CS", color: "#ec4899" },
];

// Map old Employee.department string values to new Department names
const DEPT_STRING_MAP = {
  frontend: "Web Development",
  backend: "Web Development",
  devops: "DevOps",
  qa: "Staff",
  hr: "HR",
  finance: "Tax Analyst",
  customer_support: "Customer Support",
};

// Map old position values to new ones
const POSITION_MAP = {
  ceo: "ceo",
  cto: "cto",
  team_lead: "team_lead",
  senior: "senior_engineer",
  mid: "engineer",
  junior: "junior_engineer",
};

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // Step 1: Seed departments
  console.log("\n--- Step 1: Seeding departments ---");
  const deptMap = {}; // name -> _id
  for (const dept of DEPARTMENTS_TO_SEED) {
    // Try to find by code first, then by name
    let existing = await Department.findOne({ code: dept.code });
    if (!existing) {
      existing = await Department.findOne({ name: dept.name });
    }
    if (existing) {
      // Update code/color if missing
      if (existing.code !== dept.code) {
        existing.code = dept.code;
        await existing.save();
      }
      deptMap[dept.name] = existing._id;
      console.log(`  Department "${dept.name}" already exists`);
    } else {
      const created = await Department.create(dept);
      deptMap[dept.name] = created._id;
      console.log(`  Created department "${dept.name}"`);
    }
  }

  // Step 2: Seed permissions
  console.log("\n--- Step 2: Seeding permissions ---");
  for (const perm of PERMISSIONS) {
    await Permission.findOneAndUpdate(
      { name: perm.name },
      perm,
      { upsert: true, new: true }
    );
  }
  console.log(`  Upserted ${PERMISSIONS.length} permissions`);

  // Step 3: Seed default roles
  console.log("\n--- Step 3: Seeding default roles ---");
  const roleMap = {}; // name -> _id
  for (const role of DEFAULT_ROLES) {
    const existing = await Role.findOneAndUpdate(
      { name: role.name },
      role,
      { upsert: true, new: true }
    );
    roleMap[role.name] = existing._id;
    console.log(`  Upserted role "${role.name}"`);
  }

  // Step 4: Migrate Employee.department strings to ObjectIds
  console.log("\n--- Step 4: Migrating employee departments ---");
  const employees = await Employee.find({});
  let deptMigrated = 0;
  for (const emp of employees) {
    // Check if department is already an ObjectId
    if (mongoose.Types.ObjectId.isValid(emp.department) && typeof emp.department !== "string") {
      continue;
    }
    const deptString = emp.department;
    const newDeptName = DEPT_STRING_MAP[deptString];
    if (newDeptName && deptMap[newDeptName]) {
      await Employee.updateOne(
        { _id: emp._id },
        { $set: { department: deptMap[newDeptName] } }
      );
      deptMigrated++;
    } else {
      // Fallback to Staff
      await Employee.updateOne(
        { _id: emp._id },
        { $set: { department: deptMap["Staff"] } }
      );
      deptMigrated++;
      console.log(`  Warning: Employee ${emp._id} had unknown dept "${deptString}", mapped to Staff`);
    }
  }
  console.log(`  Migrated ${deptMigrated} employee department fields`);

  // Step 5: Migrate Employee.position values
  console.log("\n--- Step 5: Migrating employee positions ---");
  let posMigrated = 0;
  for (const emp of employees) {
    const newPos = POSITION_MAP[emp.position];
    if (newPos && newPos !== emp.position) {
      await Employee.updateOne(
        { _id: emp._id },
        { $set: { position: newPos } }
      );
      posMigrated++;
    }
  }
  console.log(`  Migrated ${posMigrated} employee position fields`);

  // Step 6: Assign default roles to existing users
  console.log("\n--- Step 6: Assigning default roles ---");
  // Admins get super_admin
  const admins = await User.find({ user_type: "admin" });
  for (const admin of admins) {
    await UserRole.findOneAndUpdate(
      { user_id: admin._id, role_id: roleMap["super_admin"] },
      { user_id: admin._id, role_id: roleMap["super_admin"], assigned_at: new Date() },
      { upsert: true }
    );
  }
  console.log(`  Assigned super_admin to ${admins.length} admin(s)`);

  // Employees get roles based on position
  const freshEmployees = await Employee.find({});
  let assigned = 0;
  for (const emp of freshEmployees) {
    let roleName = "employee";
    if (["ceo", "cto", "project_manager", "team_lead"].includes(emp.position)) {
      roleName = "team_lead";
    } else if (emp.employee_type === "customer_support") {
      roleName = "customer_support";
    }

    const user = await User.findById(emp.user_id);
    if (!user || user.user_type === "admin") continue; // admins already handled

    await UserRole.findOneAndUpdate(
      { user_id: emp.user_id, role_id: roleMap[roleName] },
      { user_id: emp.user_id, role_id: roleMap[roleName], assigned_at: new Date() },
      { upsert: true }
    );
    assigned++;
  }
  console.log(`  Assigned roles to ${assigned} employee(s)`);

  console.log("\n--- Migration complete ---");
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
