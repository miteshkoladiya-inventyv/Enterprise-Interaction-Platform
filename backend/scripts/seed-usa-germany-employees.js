import "../env.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../config/database.js";

import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Company from "../models/Company.js";
import Role from "../models/Role.js";
import { UserRole } from "../models/UserRole.js";

const EMP_PW = bcrypt.hashSync("Employee@123", 10);

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const seedUsers = [
  {
    first_name: "Emily",
    last_name: "Carter",
    email: "emily.carter.usa@eip.in",
    phone: "+12125551001",
    country: "usa",
    timezone: "America/New_York",
    employee_type: "internal_team",
    department_code: "ENG",
    position: "team_lead",
    hire_date: daysAgo(420),
    role_name: "team_lead",
  },
  {
    first_name: "Michael",
    last_name: "Reed",
    email: "michael.reed.usa@eip.in",
    phone: "+13125551002",
    country: "usa",
    timezone: "America/Chicago",
    employee_type: "internal_team",
    department_code: "ENG",
    position: "senior_engineer",
    team_lead_email: "emily.carter.usa@eip.in",
    hire_date: daysAgo(260),
    role_name: "employee",
  },
  {
    first_name: "Sofia",
    last_name: "Miller",
    email: "sofia.miller.usa@eip.in",
    phone: "+14155551003",
    country: "usa",
    timezone: "America/Los_Angeles",
    employee_type: "customer_support",
    department_code: "CS",
    hire_date: daysAgo(180),
    role_name: "employee",
  },
  {
    first_name: "Lukas",
    last_name: "Schneider",
    email: "lukas.schneider.de@eip.in",
    phone: "+4915112345601",
    country: "germany",
    timezone: "Europe/Berlin",
    employee_type: "internal_team",
    department_code: "PROD",
    position: "team_lead",
    hire_date: daysAgo(390),
    role_name: "team_lead",
  },
  {
    first_name: "Hannah",
    last_name: "Fischer",
    email: "hannah.fischer.de@eip.in",
    phone: "+4915212345602",
    country: "germany",
    timezone: "Europe/Berlin",
    employee_type: "internal_team",
    department_code: "PROD",
    position: "engineer",
    team_lead_email: "lukas.schneider.de@eip.in",
    hire_date: daysAgo(210),
    role_name: "employee",
  },
  {
    first_name: "Jonas",
    last_name: "Weber",
    email: "jonas.weber.de@eip.in",
    phone: "+4915312345603",
    country: "germany",
    timezone: "Europe/Berlin",
    employee_type: "internal_team",
    department_code: "DES",
    position: "junior_engineer",
    team_lead_email: "sneha.kulkarni@eip.in",
    hire_date: daysAgo(120),
    role_name: "employee",
  },
  {
    first_name: "Olivia",
    last_name: "Turner",
    email: "olivia.turner.usa@eip.in",
    phone: "+16175551004",
    country: "usa",
    timezone: "America/New_York",
    employee_type: "internal_team",
    department_code: "DES",
    position: "intern",
    team_lead_email: "sneha.kulkarni@eip.in",
    hire_date: daysAgo(45),
    role_name: "employee",
  },
  {
    first_name: "Marta",
    last_name: "Becker",
    email: "marta.becker.de@eip.in",
    phone: "+4915412345604",
    country: "germany",
    timezone: "Europe/Berlin",
    employee_type: "customer_support",
    department_code: "CS",
    hire_date: daysAgo(140),
    role_name: "employee",
  },
];

async function ensureUserRole(userId, roleId, assignedBy) {
  const existing = await UserRole.findOne({ user_id: userId, role_id: roleId }).lean();
  if (!existing) {
    await UserRole.create({ user_id: userId, role_id: roleId, assigned_by: assignedBy });
  }
}

async function run() {
  await connectDB();
  console.log("Connected. Seeding USA/Germany employees (additive, no deletions)...");

  const internalCompany = await Company.findOne({ is_internal: true }).lean();
  if (!internalCompany) {
    throw new Error("Internal company not found. Run base seed first.");
  }

  const adminUser = await User.findOne({ user_type: "admin" }).lean();
  if (!adminUser) {
    throw new Error("Admin user not found. Run base seed first.");
  }

  const roleByName = {
    employee: await Role.findOne({ name: "employee" }).lean(),
    team_lead: await Role.findOne({ name: "team_lead" }).lean(),
  };
  if (!roleByName.employee || !roleByName.team_lead) {
    throw new Error("Required roles (employee/team_lead) not found.");
  }

  const departments = await Department.find({ is_active: true }).lean();
  const deptMap = new Map(departments.map((d) => [d.code, d]));

  let createdCount = 0;
  let skippedCount = 0;

  for (const item of seedUsers) {
    const exists = await User.findOne({ email: item.email }).lean();
    if (exists) {
      skippedCount += 1;
      console.log(`SKIP user exists: ${item.email}`);
      continue;
    }

    const department = deptMap.get(item.department_code);
    if (!department) {
      console.log(`SKIP missing department ${item.department_code}: ${item.email}`);
      skippedCount += 1;
      continue;
    }

    let teamLeadId = null;
    if (item.team_lead_email) {
      const teamLeadUser = await User.findOne({ email: item.team_lead_email }).lean();
      if (!teamLeadUser) {
        console.log(`SKIP missing team lead ${item.team_lead_email}: ${item.email}`);
        skippedCount += 1;
        continue;
      }
      const teamLeadEmployee = await Employee.findOne({ user_id: teamLeadUser._id }).lean();
      if (!teamLeadEmployee) {
        console.log(`SKIP missing team lead employee record ${item.team_lead_email}: ${item.email}`);
        skippedCount += 1;
        continue;
      }
      teamLeadId = teamLeadEmployee._id;
    }

    const user = await User.create({
      email: item.email,
      password_hash: EMP_PW,
      user_type: "employee",
      status: "active",
      first_name: item.first_name,
      last_name: item.last_name,
      phone: item.phone,
      country: item.country,
      timezone: item.timezone,
      company_id: internalCompany._id,
      last_login: new Date(),
    });

    await Employee.create({
      user_id: user._id,
      employee_type: item.employee_type,
      department: department._id,
      position: item.position,
      team_lead_id: teamLeadId,
      hire_date: item.hire_date,
      is_active: true,
    });

    await ensureUserRole(
      user._id,
      roleByName[item.role_name]._id,
      adminUser._id
    );

    createdCount += 1;
    console.log(`CREATE ${item.email} (${item.country.toUpperCase()})`);
  }

  console.log("Done.");
  console.log(`Created: ${createdCount}`);
  console.log(`Skipped: ${skippedCount}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Seed failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
