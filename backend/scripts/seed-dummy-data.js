/**
 * Seed script — populates the database with Indian-themed dummy data.
 *
 * Usage:  cd backend && node scripts/seed-dummy-data.js
 *
 * What it creates:
 *   • 1 Company (internal)
 *   • 5 Departments
 *   • 3 Roles + Permissions
 *   • 1 Admin user  (admin@eip.in / Admin@123)
 *   • 10 Employee users  (password: Employee@123)
 *   • 3 Customer users   (password: Customer@123)
 *   • Group & direct chat channels + messages
 *   • Meetings (scheduled + ended)
 *   • Support tickets + ticket messages
 *   • Files
 *   • Documents
 */

import "../env.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import connectDB from "../config/database.js";

// ── Models ──────────────────────────────────────────────
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Company from "../models/Company.js";
import { ChatChannel } from "../models/ChatChannel.js";
import { ChannelMember } from "../models/ChannelMember.js";
import { Message } from "../models/Message.js";
import Meeting from "../models/Meeting.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { TicketMessage } from "../models/TicketMessage.js";
import Role from "../models/Role.js";
import { UserRole } from "../models/UserRole.js";
import Permission from "../models/Permission.js";
import File from "../models/File.js";
import Document from "../models/Document.js";
import { Customer } from "../models/Customer.js";

// ── Helpers ─────────────────────────────────────────────
const hash = (pw) => bcrypt.hashSync(pw, 10);
const oid = () => new mongoose.Types.ObjectId();
const pastDate = (daysAgo) => new Date(Date.now() - daysAgo * 86400000);
const futureDate = (daysAhead) => new Date(Date.now() + daysAhead * 86400000);
const randomCode = () => crypto.randomBytes(4).toString("hex");

// ── Data ────────────────────────────────────────────────
const ADMIN_PW = hash("Admin@123");
const EMP_PW = hash("Employee@123");
const CUST_PW = hash("Customer@123");

async function seed() {
  await connectDB();
  console.log("Connected to MongoDB. Seeding…");

  // ═══════════════════════════════════════════════════════
  // 0. Clean existing seed data (all collections)
  // ═══════════════════════════════════════════════════════
  await Promise.all([
    User.deleteMany({}),
    Employee.deleteMany({}),
    Department.deleteMany({}),
    Company.deleteMany({}),
    ChatChannel.deleteMany({}),
    ChannelMember.deleteMany({}),
    Message.deleteMany({}),
    Meeting.deleteMany({}),
    SupportTicket.deleteMany({}),
    TicketMessage.deleteMany({}),
    Role.deleteMany({}),
    UserRole.deleteMany({}),
    Permission.deleteMany({}),
    File.deleteMany({}),
    Document.deleteMany({}),
    Customer.deleteMany({}),
  ]);
  console.log("  ✓ Cleared all collections");

  // ═══════════════════════════════════════════════════════
  // 1. Company
  // ═══════════════════════════════════════════════════════
  const company = await Company.create({
    name: "TechVista Solutions Pvt. Ltd.",
    country: "india",
    address: "4th Floor, Tower B, Cyber City, Gurugram, Haryana 122002",
    industry: "Information Technology",
    is_internal: true,
  });
  console.log("  ✓ Company created");

  // ═══════════════════════════════════════════════════════
  // 2. Departments
  // ═══════════════════════════════════════════════════════
  const depts = await Department.insertMany([
    { name: "Engineering", code: "ENG", description: "Software development and architecture", color: "#6366f1" },
    { name: "Customer Support", code: "CS", description: "Customer-facing support operations", color: "#10b981" },
    { name: "Product", code: "PROD", description: "Product management and strategy", color: "#f59e0b" },
    { name: "Human Resources", code: "HR", description: "People operations and talent management", color: "#ec4899" },
    { name: "Design", code: "DES", description: "UI/UX and visual design", color: "#8b5cf6" },
  ]);
  const [engDept, csDept, prodDept, hrDept, desDept] = depts;
  console.log("  ✓ 5 Departments created");

  // ═══════════════════════════════════════════════════════
  // 3. Permissions & Roles
  // ═══════════════════════════════════════════════════════
  const permNames = [
    { name: "manage_users", description: "Create / edit / deactivate users", category: "users" },
    { name: "manage_departments", description: "CRUD departments", category: "departments" },
    { name: "manage_roles", description: "CRUD roles & assign", category: "roles" },
    { name: "view_tickets", description: "View support tickets", category: "tickets" },
    { name: "manage_tickets", description: "Create / assign / close tickets", category: "tickets" },
    { name: "view_meetings", description: "View meetings", category: "meetings" },
    { name: "manage_meetings", description: "Create / schedule meetings", category: "meetings" },
    { name: "manage_files", description: "Upload / manage all files", category: "files" },
    { name: "view_files", description: "View accessible files", category: "files" },
    { name: "send_messages", description: "Send chat messages", category: "chat" },
    { name: "manage_channels", description: "Create and manage channels", category: "chat" },
  ];
  const perms = await Permission.insertMany(permNames);
  const allPermNames = perms.map((p) => p.name);

  const roles = await Role.insertMany([
    { name: "admin", display_name: "Administrator", hierarchy_level: 100, permissions: allPermNames, is_system: true, description: "Full system access" },
    { name: "employee", display_name: "Employee", hierarchy_level: 10, permissions: ["view_tickets", "view_meetings", "view_files", "send_messages"], is_system: true, description: "Standard employee" },
    { name: "team_lead", display_name: "Team Lead", hierarchy_level: 50, permissions: ["view_tickets", "manage_tickets", "view_meetings", "manage_meetings", "view_files", "manage_files", "send_messages", "manage_channels"], is_system: false, description: "Team lead with elevated access" },
  ]);
  const [adminRole, empRole, tlRole] = roles;
  console.log("  ✓ Permissions & Roles created");

  // ═══════════════════════════════════════════════════════
  // 4. Admin user
  // ═══════════════════════════════════════════════════════
  const adminUser = await User.create({
    email: "admin@eip.in",
    password_hash: ADMIN_PW,
    user_type: "admin",
    status: "active",
    first_name: "Rajesh",
    last_name: "Sharma",
    phone: "+919876543210",
    country: "india",
    timezone: "Asia/Kolkata",
    company_id: company._id,
    last_login: new Date(),
  });
  await UserRole.create({ user_id: adminUser._id, role_id: adminRole._id, assigned_by: adminUser._id });
  console.log("  ✓ Admin user: admin@eip.in / Admin@123");

  // ── Your original admin account ──
  const miteshUser = await User.create({
    email: "miteshkoladiya111.ba@gmail.com",
    password_hash: hash("miteshkoladiya111.ba@gmail.com"),
    user_type: "admin",
    status: "active",
    first_name: "Mitesh",
    last_name: "Koladiya",
    country: "india",
    timezone: "Asia/Kolkata",
    company_id: company._id,
    last_login: new Date(),
  });
  await UserRole.create({ user_id: miteshUser._id, role_id: adminRole._id, assigned_by: miteshUser._id });
  console.log("  ✓ Admin user: miteshkoladiya111.ba@gmail.com");

  // ═══════════════════════════════════════════════════════
  // 5. Employee users
  // ═══════════════════════════════════════════════════════
  const empData = [
    // Engineering
    { first: "Ananya", last: "Verma", email: "ananya.verma@eip.in", dept: engDept._id, pos: "team_lead", type: "internal_team", phone: "+919812345001" },
    { first: "Vikram", last: "Patel", email: "vikram.patel@eip.in", dept: engDept._id, pos: "senior_engineer", type: "internal_team", phone: "+919812345002" },
    { first: "Priya", last: "Nair", email: "priya.nair@eip.in", dept: engDept._id, pos: "engineer", type: "internal_team", phone: "+919812345003" },
    { first: "Arjun", last: "Reddy", email: "arjun.reddy@eip.in", dept: engDept._id, pos: "junior_engineer", type: "internal_team", phone: "+919812345004" },
    // Customer Support
    { first: "Meera", last: "Joshi", email: "meera.joshi@eip.in", dept: csDept._id, pos: null, type: "customer_support", phone: "+919812345005" },
    { first: "Rohan", last: "Gupta", email: "rohan.gupta@eip.in", dept: csDept._id, pos: null, type: "customer_support", phone: "+919812345006" },
    // Product
    { first: "Kavitha", last: "Iyer", email: "kavitha.iyer@eip.in", dept: prodDept._id, pos: "project_manager", type: "internal_team", phone: "+919812345007" },
    // HR
    { first: "Deepak", last: "Singh", email: "deepak.singh@eip.in", dept: hrDept._id, pos: "team_lead", type: "internal_team", phone: "+919812345008" },
    // Design
    { first: "Sneha", last: "Kulkarni", email: "sneha.kulkarni@eip.in", dept: desDept._id, pos: "team_lead", type: "internal_team", phone: "+919812345009" },
    { first: "Ravi", last: "Menon", email: "ravi.menon@eip.in", dept: desDept._id, pos: "engineer", type: "internal_team", phone: "+919812345010" },
  ];

  const empUsers = [];
  const empRecords = [];

  for (const e of empData) {
    const user = await User.create({
      email: e.email,
      password_hash: EMP_PW,
      user_type: "employee",
      status: "active",
      first_name: e.first,
      last_name: e.last,
      phone: e.phone,
      country: "india",
      timezone: "Asia/Kolkata",
      company_id: company._id,
      last_login: pastDate(Math.floor(Math.random() * 5)),
    });
    empUsers.push(user);
  }

  // Create employee records (need user IDs first)
  // Ananya is team_lead for eng
  const ananyaEmp = await Employee.create({ user_id: empUsers[0]._id, employee_type: "internal_team", department: engDept._id, position: "team_lead", hire_date: pastDate(365) });
  const vikramEmp = await Employee.create({ user_id: empUsers[1]._id, employee_type: "internal_team", department: engDept._id, position: "senior_engineer", team_lead_id: ananyaEmp._id, hire_date: pastDate(300) });
  const priyaEmp  = await Employee.create({ user_id: empUsers[2]._id, employee_type: "internal_team", department: engDept._id, position: "engineer", team_lead_id: ananyaEmp._id, hire_date: pastDate(200) });
  const arjunEmp  = await Employee.create({ user_id: empUsers[3]._id, employee_type: "internal_team", department: engDept._id, position: "junior_engineer", team_lead_id: ananyaEmp._id, hire_date: pastDate(90) });
  const meeraEmp  = await Employee.create({ user_id: empUsers[4]._id, employee_type: "customer_support", department: csDept._id, hire_date: pastDate(250) });
  const rohanEmp  = await Employee.create({ user_id: empUsers[5]._id, employee_type: "customer_support", department: csDept._id, hire_date: pastDate(180) });
  const kavithaEmp = await Employee.create({ user_id: empUsers[6]._id, employee_type: "internal_team", department: prodDept._id, position: "project_manager", hire_date: pastDate(400) });
  const deepakEmp = await Employee.create({ user_id: empUsers[7]._id, employee_type: "internal_team", department: hrDept._id, position: "team_lead", hire_date: pastDate(500) });
  const snehaEmp  = await Employee.create({ user_id: empUsers[8]._id, employee_type: "internal_team", department: desDept._id, position: "team_lead", hire_date: pastDate(350) });
  const raviEmp   = await Employee.create({ user_id: empUsers[9]._id, employee_type: "internal_team", department: desDept._id, position: "engineer", team_lead_id: snehaEmp._id, hire_date: pastDate(150) });
  empRecords.push(ananyaEmp, vikramEmp, priyaEmp, arjunEmp, meeraEmp, rohanEmp, kavithaEmp, deepakEmp, snehaEmp, raviEmp);

  // Set department heads
  await Department.updateOne({ _id: engDept._id }, { head_id: ananyaEmp._id });
  await Department.updateOne({ _id: csDept._id }, { head_id: meeraEmp._id });
  await Department.updateOne({ _id: prodDept._id }, { head_id: kavithaEmp._id });
  await Department.updateOne({ _id: hrDept._id }, { head_id: deepakEmp._id });
  await Department.updateOne({ _id: desDept._id }, { head_id: snehaEmp._id });

  // Assign roles
  const roleAssignments = empUsers.map((u, i) => {
    const roleId = [0, 6, 7, 8].includes(i) ? tlRole._id : empRole._id; // team leads & PM get tlRole
    return { user_id: u._id, role_id: roleId, assigned_by: adminUser._id };
  });
  await UserRole.insertMany(roleAssignments);
  console.log("  ✓ 10 Employees created");

  // ═══════════════════════════════════════════════════════
  // 6. Customer users
  // ═══════════════════════════════════════════════════════
  const custData = [
    { first: "Suresh", last: "Gowda", email: "suresh.gowda@gmail.com", phone: "+919812345011", custType: "business", sub: "Enterprise" },
    { first: "Lakshmi", last: "Rao", email: "lakshmi.rao@outlook.com", phone: "+919812345012", custType: "individual", sub: "Pro" },
    { first: "Amar", last: "Das", email: "amar.das@yahoo.com", phone: "+919812345013", custType: "business", sub: "Starter" },
  ];

  const custUsers = [];
  const custRecords = [];
  for (const c of custData) {
    const user = await User.create({
      email: c.email,
      password_hash: CUST_PW,
      user_type: "customer",
      status: "active",
      first_name: c.first,
      last_name: c.last,
      phone: c.phone,
      country: "india",
      timezone: "Asia/Kolkata",
      company_id: company._id,
    });
    custUsers.push(user);
    const cust = await Customer.create({
      user_id: user._id,
      customer_type: c.custType,
      assigned_support_agent_id: c.custType === "business" ? meeraEmp._id : rohanEmp._id,
      subscription_tier: c.sub,
      onboarding_status: "completed",
    });
    custRecords.push(cust);
  }
  console.log("  ✓ 3 Customers created");

  // ═══════════════════════════════════════════════════════
  // 7. Chat channels & messages
  // ═══════════════════════════════════════════════════════
  const allEmpIds = empUsers.map((u) => u._id);

  // Group channel — Engineering
  const engChannel = await ChatChannel.create({ channel_type: "group", name: "Engineering Team", created_by: empUsers[0]._id });
  await ChannelMember.insertMany([
    { channel_id: engChannel._id, user_id: empUsers[0]._id, role: "admin" },
    { channel_id: engChannel._id, user_id: empUsers[1]._id },
    { channel_id: engChannel._id, user_id: empUsers[2]._id },
    { channel_id: engChannel._id, user_id: empUsers[3]._id },
  ]);

  // Group channel — All Hands
  const allHandsChannel = await ChatChannel.create({ channel_type: "group", name: "All Hands", created_by: adminUser._id });
  const allHandsMembers = [adminUser._id, ...allEmpIds].map((uid) => ({ channel_id: allHandsChannel._id, user_id: uid }));
  allHandsMembers[0].role = "admin";
  await ChannelMember.insertMany(allHandsMembers);

  // Direct channel — Ananya & Vikram
  const dmChannel = await ChatChannel.create({ channel_type: "direct", created_by: empUsers[0]._id });
  await ChannelMember.insertMany([
    { channel_id: dmChannel._id, user_id: empUsers[0]._id },
    { channel_id: dmChannel._id, user_id: empUsers[1]._id },
  ]);

  // Support channel — linked to a ticket (created later, update post-ticket)
  const supportChannel = await ChatChannel.create({ channel_type: "support", name: "Support: Billing Issue", created_by: custUsers[0]._id });
  await ChannelMember.insertMany([
    { channel_id: supportChannel._id, user_id: custUsers[0]._id },
    { channel_id: supportChannel._id, user_id: empUsers[4]._id },
  ]);

  // ── Messages ──
  const engMessages = [
    { sender: empUsers[0], content: "Good morning team! Sprint planning at 10:30 today 🙏", ago: 2 },
    { sender: empUsers[1], content: "Namaste Ananya! I'll have the API docs ready before that", ago: 2 },
    { sender: empUsers[2], content: "I finished the pagination PR, can someone review it?", ago: 2 },
    { sender: empUsers[3], content: "I'll review it Priya, looking at it now", ago: 2 },
    { sender: empUsers[0], content: "Great teamwork! Let's also discuss the Mumbai deployment timeline", ago: 1 },
    { sender: empUsers[1], content: "We need to test on the staging server in Pune first", ago: 1 },
    { sender: empUsers[2], content: "The Redis caching layer is showing 40% improvement in response times 🎉", ago: 0.5 },
    { sender: empUsers[3], content: "That's amazing! Should we present it in the all-hands?", ago: 0.3 },
  ];

  for (const m of engMessages) {
    await Message.create({
      channel_id: engChannel._id,
      sender_id: m.sender._id,
      content: m.content,
      message_type: "text",
      created_at: pastDate(m.ago),
    });
  }

  const allHandsMessages = [
    { sender: adminUser, content: "Namaste everyone! Welcome to this week's update channel 🇮🇳", ago: 3 },
    { sender: adminUser, content: "Q4 targets are looking strong. Mumbai and Bengaluru teams are crushing it!", ago: 3 },
    { sender: empUsers[6], content: "Product roadmap for next quarter is ready for review. Check the shared doc!", ago: 2 },
    { sender: empUsers[7], content: "Reminder: Diwali celebration event details will be shared by EOD", ago: 1 },
    { sender: empUsers[8], content: "New design system components are live on Figma. Please take a look 🎨", ago: 0.5 },
    { sender: empUsers[0], content: "Engineering sprint velocity improved by 20% this month. Kudos team! 🚀", ago: 0.2 },
  ];

  for (const m of allHandsMessages) {
    await Message.create({
      channel_id: allHandsChannel._id,
      sender_id: m.sender._id,
      content: m.content,
      message_type: "text",
      created_at: pastDate(m.ago),
    });
  }

  const dmMessages = [
    { sender: empUsers[0], content: "Vikram, can you check the Kubernetes config for the Hyderabad cluster?", ago: 1 },
    { sender: empUsers[1], content: "Sure, I noticed the pod scaling wasn't set correctly. Fixing it now", ago: 1 },
    { sender: empUsers[0], content: "Thanks! Also the client from Jaipur wants the API integrated by Friday", ago: 0.5 },
    { sender: empUsers[1], content: "Noted. I'll prioritize it after lunch. Chai break? ☕", ago: 0.3 },
    { sender: empUsers[0], content: "Always! Meet me at the pantry in 5 mins 😄", ago: 0.2 },
  ];

  for (const m of dmMessages) {
    await Message.create({
      channel_id: dmChannel._id,
      sender_id: m.sender._id,
      content: m.content,
      message_type: "text",
      created_at: pastDate(m.ago),
    });
  }

  const supportMessages = [
    { sender: custUsers[0], content: "Hi, I have a question about our enterprise billing cycle", ago: 1 },
    { sender: empUsers[4], content: "Namaste Suresh ji! Happy to help. Could you share your account ID?", ago: 1 },
    { sender: custUsers[0], content: "Sure, it's ENT-2024-0451. We were charged twice this month", ago: 0.8 },
    { sender: empUsers[4], content: "Let me check that right away. One moment please 🙏", ago: 0.7 },
    { sender: empUsers[4], content: "Found it! There was a duplicate charge. I've initiated the refund — it will reflect in 3-5 business days", ago: 0.5 },
    { sender: custUsers[0], content: "Dhanyavaad! That was quick. Appreciate the help 👍", ago: 0.3 },
  ];

  for (const m of supportMessages) {
    await Message.create({
      channel_id: supportChannel._id,
      sender_id: m.sender._id,
      content: m.content,
      message_type: "text",
      created_at: pastDate(m.ago),
    });
  }

  // Add some reactions to engineering messages
  const engMsgs = await Message.find({ channel_id: engChannel._id }).sort({ created_at: 1 });
  if (engMsgs.length >= 7) {
    engMsgs[6].reactions.push(
      { emoji: "🎉", user_id: empUsers[0]._id },
      { emoji: "🎉", user_id: empUsers[1]._id },
      { emoji: "🔥", user_id: empUsers[3]._id },
    );
    await engMsgs[6].save();
  }

  console.log("  ✓ Chat channels & messages created");

  // ═══════════════════════════════════════════════════════
  // 8. Meetings
  // ═══════════════════════════════════════════════════════
  const meetings = await Meeting.insertMany([
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Sprint Planning — Week 49",
      description: "Weekly sprint planning for the engineering team",
      host_id: empUsers[0]._id,
      participants: [empUsers[0]._id, empUsers[1]._id, empUsers[2]._id, empUsers[3]._id],
      meeting_type: "internal",
      scheduled_at: futureDate(1),
      duration_minutes: 60,
      status: "scheduled",
      open_to_everyone: false,
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "All-Hands Monthly Review",
      description: "Company-wide monthly review and announcements",
      host_id: adminUser._id,
      participants: [adminUser._id, ...allEmpIds],
      meeting_type: "internal",
      scheduled_at: futureDate(3),
      duration_minutes: 90,
      status: "scheduled",
      open_to_everyone: true,
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Product Roadmap Discussion",
      description: "Review Q1 product roadmap with stakeholders",
      host_id: empUsers[6]._id,
      participants: [empUsers[6]._id, empUsers[0]._id, empUsers[8]._id, adminUser._id],
      meeting_type: "internal",
      scheduled_at: futureDate(5),
      duration_minutes: 45,
      status: "scheduled",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Customer Onboarding — Gowda Enterprises",
      description: "Onboarding session with Suresh Gowda from Gowda Enterprises",
      host_id: empUsers[4]._id,
      participants: [empUsers[4]._id, custUsers[0]._id],
      meeting_type: "customer_consultation",
      scheduled_at: futureDate(2),
      duration_minutes: 30,
      status: "scheduled",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Design Review — Dashboard Redesign",
      description: "Review the new admin dashboard mockups",
      host_id: empUsers[8]._id,
      participants: [empUsers[8]._id, empUsers[9]._id, empUsers[6]._id],
      meeting_type: "internal",
      scheduled_at: pastDate(2),
      started_at: pastDate(2),
      ended_at: new Date(pastDate(2).getTime() + 45 * 60000),
      duration_minutes: 45,
      status: "ended",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Diwali Planning Committee",
      description: "Plan the office Diwali celebration event",
      host_id: empUsers[7]._id,
      participants: [empUsers[7]._id, empUsers[0]._id, empUsers[4]._id, empUsers[8]._id],
      meeting_type: "internal",
      scheduled_at: pastDate(5),
      started_at: pastDate(5),
      ended_at: new Date(pastDate(5).getTime() + 30 * 60000),
      duration_minutes: 30,
      status: "ended",
    },
  ]);
  console.log("  ✓ 6 Meetings created");

  // ═══════════════════════════════════════════════════════
  // 9. Support tickets & ticket messages
  // ═══════════════════════════════════════════════════════
  const tickets = [
    {
      ticket_number: "TKT-2024-001",
      customer_id: custRecords[0]._id,
      assigned_agent_id: meeraEmp._id,
      title: "Duplicate billing charge",
      description: "We were charged twice for the month of November. Enterprise plan — Account ID: ENT-2024-0451.",
      priority: "high",
      status: "in_progress",
      category: "Billing",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-002",
      customer_id: custRecords[1]._id,
      assigned_agent_id: rohanEmp._id,
      title: "Unable to export reports as PDF",
      description: "When I click on Export PDF the page just reloads. Using Chrome on Windows 11.",
      priority: "medium",
      status: "open",
      category: "Bug Report",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-003",
      customer_id: custRecords[2]._id,
      assigned_agent_id: meeraEmp._id,
      title: "Request for API access",
      description: "We need REST API access to integrate with our ERP system (Tally). Please provide API docs and credentials.",
      priority: "low",
      status: "pending",
      category: "Feature Request",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-004",
      customer_id: custRecords[0]._id,
      assigned_agent_id: rohanEmp._id,
      collaborators: [meeraEmp._id],
      title: "Data migration from legacy system",
      description: "Need assistance migrating 50,000 records from our old Oracle DB to the new platform.",
      priority: "critical",
      status: "in_progress",
      category: "Migration",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-005",
      customer_id: custRecords[1]._id,
      assigned_agent_id: meeraEmp._id,
      title: "Password reset not working",
      description: "I requested a password reset but the email never arrived. Checked spam folder too.",
      priority: "medium",
      status: "resolved",
      category: "Account",
      country: "india",
      resolved_at: pastDate(1),
    },
  ];

  const createdTickets = await SupportTicket.insertMany(tickets);

  // Update support channel with ticket reference
  await ChatChannel.updateOne({ _id: supportChannel._id }, { ticket_id: createdTickets[0]._id });

  // Ticket messages
  const ticketMsgs = [
    // Ticket 1 messages
    { ticket_id: createdTickets[0]._id, sender_id: custUsers[0]._id, content: "Please look into this urgently. Our finance team is asking for clarification." },
    { ticket_id: createdTickets[0]._id, sender_id: empUsers[4]._id, content: "I've escalated this to the billing team. Refund has been initiated." },
    { ticket_id: createdTickets[0]._id, sender_id: empUsers[4]._id, content: "Update: Refund of ₹24,999 will reflect in your account within 3-5 working days." },
    // Ticket 2 messages
    { ticket_id: createdTickets[1]._id, sender_id: custUsers[1]._id, content: "This has been happening since last Tuesday after the update." },
    { ticket_id: createdTickets[1]._id, sender_id: empUsers[5]._id, content: "Thank you for reporting. Our QA team in Bengaluru is investigating. Can you share a screenshot?" },
    // Ticket 4 messages
    { ticket_id: createdTickets[3]._id, sender_id: custUsers[0]._id, content: "We have CSV exports from Tally ready. What's the best way to share securely?" },
    { ticket_id: createdTickets[3]._id, sender_id: empUsers[5]._id, content: "Please upload via our secure file portal. I'll set up a migration sandbox environment in Mumbai region." },
    { ticket_id: createdTickets[3]._id, sender_id: empUsers[4]._id, content: "I'm joining as a collaborator. We'll allocate resources from the Chennai data center for this." },
  ];
  await TicketMessage.insertMany(ticketMsgs);
  console.log("  ✓ 5 Support tickets + messages created");

  // ═══════════════════════════════════════════════════════
  // 10. Files
  // ═══════════════════════════════════════════════════════
  const files = [
    {
      file_name: "Q4_Revenue_Report.pdf",
      file_type: "application/pdf",
      file_size: 2456789,
      storage_path: "files/q4-revenue-report.pdf",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/q4-revenue-report.pdf",
      uploaded_by: adminUser._id,
      uploader_info: { name: "Rajesh Sharma", email: "admin@eip.in" },
      country: "india",
      permissions: { is_public: true, user_ids: [], department: null },
      metadata: { description: "Q4 FY2024 revenue report for all regions", tags: ["finance", "quarterly", "revenue"], category: "Reports" },
    },
    {
      file_name: "Engineering_Sprint_Notes.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_size: 156234,
      storage_path: "files/eng-sprint-notes.docx",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/eng-sprint-notes.docx",
      uploaded_by: empUsers[0]._id,
      uploader_info: { name: "Ananya Verma", email: "ananya.verma@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [empUsers[1]._id, empUsers[2]._id, empUsers[3]._id], department: "Engineering" },
      metadata: { description: "Weekly sprint notes for the engineering team", tags: ["engineering", "sprint", "agile"], category: "Documents" },
    },
    {
      file_name: "Product_Roadmap_2025.pptx",
      file_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 4567890,
      storage_path: "files/product-roadmap-2025.pptx",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/product-roadmap-2025.pptx",
      uploaded_by: empUsers[6]._id,
      uploader_info: { name: "Kavitha Iyer", email: "kavitha.iyer@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [adminUser._id, empUsers[0]._id, empUsers[8]._id], department: null },
      metadata: { description: "Product vision and roadmap for 2025", tags: ["product", "roadmap", "strategy"], category: "Presentations" },
    },
    {
      file_name: "Employee_Handbook_India.pdf",
      file_type: "application/pdf",
      file_size: 3245678,
      storage_path: "files/employee-handbook-india.pdf",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/employee-handbook-india.pdf",
      uploaded_by: empUsers[7]._id,
      uploader_info: { name: "Deepak Singh", email: "deepak.singh@eip.in" },
      country: "india",
      permissions: { is_public: true, user_ids: [], department: null },
      metadata: { description: "Company employee handbook — India edition", tags: ["hr", "handbook", "policy"], category: "HR" },
    },
    {
      file_name: "Design_System_V2.fig",
      file_type: "application/octet-stream",
      file_size: 8901234,
      storage_path: "files/design-system-v2.fig",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/design-system-v2.fig",
      uploaded_by: empUsers[8]._id,
      uploader_info: { name: "Sneha Kulkarni", email: "sneha.kulkarni@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [empUsers[9]._id, empUsers[6]._id], department: "Design" },
      metadata: { description: "Design system v2 — updated components and tokens", tags: ["design", "figma", "ui"], category: "Design" },
    },
    {
      file_name: "Mumbai_Deployment_Checklist.xlsx",
      file_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      file_size: 98765,
      storage_path: "files/mumbai-deployment-checklist.xlsx",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/mumbai-deployment-checklist.xlsx",
      uploaded_by: empUsers[1]._id,
      uploader_info: { name: "Vikram Patel", email: "vikram.patel@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [empUsers[0]._id, empUsers[2]._id], department: "Engineering" },
      metadata: { description: "Deployment checklist for Mumbai data center migration", tags: ["devops", "deployment", "mumbai"], category: "Operations" },
    },
  ];

  await File.insertMany(files);
  console.log("  ✓ 6 Files created");

  // ═══════════════════════════════════════════════════════
  // 11. Documents (collaborative)
  // ═══════════════════════════════════════════════════════
  const docs = [
    {
      title: "Engineering Standards & Best Practices",
      content: `# Engineering Standards — TechVista Solutions

## Code Review Guidelines
- All PRs must have at least 2 approvals before merging
- Use conventional commit messages (feat:, fix:, chore:)
- Include unit tests for new features — minimum 80% coverage

## Naming Conventions
- **React components**: PascalCase (e.g., DashboardCard)
- **API endpoints**: kebab-case (e.g., /api/user-roles)
- **Database columns**: snake_case (e.g., created_at)

## Deployment Process
1. Push to staging branch → triggers auto-deploy to Pune staging
2. QA verification on staging (2 business days)
3. Merge to main → deploys to Mumbai production
4. Post-deployment smoke tests

## Tech Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: MongoDB Atlas (Mumbai region)
- Cache: Redis (ElastiCache)
- CI/CD: GitHub Actions

_Last updated by Ananya Verma_`,
      owner: empUsers[0]._id,
      collaborators: [
        { user: empUsers[1]._id, access: "write" },
        { user: empUsers[2]._id, access: "write" },
        { user: empUsers[3]._id, access: "read" },
      ],
      is_public: false,
    },
    {
      title: "Diwali Celebration Event Plan 2024",
      content: `# Diwali Celebration 2024 — TechVista 🪔

## Event Details
- **Date**: November 1, 2024 (Friday)
- **Time**: 4:00 PM – 8:00 PM
- **Venue**: TechVista Office Terrace, Cyber City, Gurugram

## Agenda
| Time | Activity |
|------|----------|
| 4:00 PM | Rangoli competition |
| 5:00 PM | Diya decoration workshop |
| 5:45 PM | Team performances |
| 6:30 PM | Dinner (catered by Haldiram's) |
| 7:30 PM | Lucky draw & prizes |

## Budget
- Decoration: ₹25,000
- Food & beverages: ₹50,000
- Prizes & gifts: ₹30,000
- Entertainment: ₹15,000
- **Total**: ₹1,20,000

## Committee
- Deepak Singh (Lead)
- Sneha Kulkarni (Decoration)
- Meera Joshi (Food & logistics)
- Ravi Menon (Entertainment)

_Happy Diwali! 🎆_`,
      owner: empUsers[7]._id,
      collaborators: [
        { user: empUsers[8]._id, access: "write" },
        { user: empUsers[4]._id, access: "write" },
        { user: empUsers[9]._id, access: "write" },
      ],
      is_public: true,
    },
    {
      title: "Customer Support Playbook",
      content: `# Customer Support Playbook

## Response Time SLAs
| Priority | First Response | Resolution |
|----------|---------------|------------|
| Critical | 1 hour | 4 hours |
| High | 4 hours | 24 hours |
| Medium | 8 hours | 48 hours |
| Low | 24 hours | 5 days |

## Escalation Matrix
1. **Level 1**: Support Agent (Meera / Rohan)
2. **Level 2**: Team Lead → Engineering
3. **Level 3**: Rajesh Sharma (Admin)

## Common Issues & Quick Fixes
### Password Reset
- Verify email in User table
- Check spam filters
- Resend via admin panel

### Billing Queries
- Always check for duplicate charges first
- Refunds take 3-5 business days (NEFT/RTGS)
- Escalate GST-related queries to finance

### API Access Requests
- Verify subscription tier (Enterprise only)
- Generate API keys from admin panel
- Share Postman collection link

_Maintained by Customer Support Team_`,
      owner: empUsers[4]._id,
      collaborators: [
        { user: empUsers[5]._id, access: "write" },
        { user: adminUser._id, access: "read" },
      ],
      is_public: false,
    },
  ];

  for (const d of docs) {
    await Document.create(d);
  }
  console.log("  ✓ 3 Documents created");

  // ═══════════════════════════════════════════════════════
  // Done
  // ═══════════════════════════════════════════════════════
  console.log("\n✅ Seed complete! Summary:");
  console.log("   • 1 Company");
  console.log("   • 5 Departments");
  console.log("   • 11 Permissions, 3 Roles");
  console.log("   • 1 Admin (admin@eip.in / Admin@123)");
  console.log("   • 10 Employees (Employee@123)");
  console.log("   • 3 Customers (Customer@123)");
  console.log("   • 4 Chat channels + 25 messages");
  console.log("   • 6 Meetings (4 scheduled, 2 ended)");
  console.log("   • 5 Support tickets + 8 ticket messages");
  console.log("   • 6 Files");
  console.log("   • 3 Documents");
  console.log("\n   Employee logins:");
  empData.forEach((e) => console.log(`     ${e.email} / Employee@123`));
  console.log("\n   Customer logins:");
  custData.forEach((c) => console.log(`     ${c.email} / Customer@123`));

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
