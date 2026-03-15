/**
 * ADDITIVE seed script — adds more data WITHOUT deleting existing data.
 *
 * Usage:  cd backend && node scripts/seed-more-data.js
 *
 * What it adds:
 *   • 3 more Companies (client companies)
 *   • 3 more Departments (QA, DevOps, Finance) + 4 Teams under departments
 *   • 15 more Employees across ALL departments (password: Employee@123)
 *   • 5 more Customers from different companies (password: Customer@123)
 *   • Department-wise group channels + messages
 *   • More DMs, meetings, tickets, files, documents
 */

import "../env.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import connectDB from "../config/database.js";

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
import File from "../models/File.js";
import Document from "../models/Document.js";
import { Customer } from "../models/Customer.js";

const hash = (pw) => bcrypt.hashSync(pw, 10);
const pastDate = (daysAgo) => new Date(Date.now() - daysAgo * 86400000);
const futureDate = (daysAhead) => new Date(Date.now() + daysAhead * 86400000);
const randomCode = () => crypto.randomBytes(4).toString("hex");
const EMP_PW = hash("Employee@123");
const CUST_PW = hash("Customer@123");

async function seedMore() {
  await connectDB();
  console.log("Connected to MongoDB. Adding more data (existing data preserved)…\n");

  // ── Fetch existing references ──
  const existingCompany = await Company.findOne({ is_internal: true });
  if (!existingCompany) { console.error("No internal company found. Run seed-dummy-data.js first."); process.exit(1); }

  const existingDepts = await Department.find({});
  const engDept = existingDepts.find(d => d.code === "ENG");
  const csDept = existingDepts.find(d => d.code === "CS");
  const prodDept = existingDepts.find(d => d.code === "PROD");
  const hrDept = existingDepts.find(d => d.code === "HR");
  const desDept = existingDepts.find(d => d.code === "DES");

  const adminRole = await Role.findOne({ name: "admin" });
  const empRole = await Role.findOne({ name: "employee" });
  const tlRole = await Role.findOne({ name: "team_lead" });

  const adminUser = await User.findOne({ email: "admin@eip.in" });
  if (!adminUser) { console.error("Admin user not found. Run seed-dummy-data.js first."); process.exit(1); }

  // Fetch existing employees (the 10 original ones)
  const ananyaUser = await User.findOne({ email: "ananya.verma@eip.in" });
  const vikramUser = await User.findOne({ email: "vikram.patel@eip.in" });
  const priyaUser = await User.findOne({ email: "priya.nair@eip.in" });
  const arjunUser = await User.findOne({ email: "arjun.reddy@eip.in" });
  const meeraUser = await User.findOne({ email: "meera.joshi@eip.in" });
  const rohanUser = await User.findOne({ email: "rohan.gupta@eip.in" });
  const kavithaUser = await User.findOne({ email: "kavitha.iyer@eip.in" });
  const deepakUser = await User.findOne({ email: "deepak.singh@eip.in" });
  const snehaUser = await User.findOne({ email: "sneha.kulkarni@eip.in" });
  const raviUser = await User.findOne({ email: "ravi.menon@eip.in" });

  const meeraEmp = await Employee.findOne({ user_id: meeraUser._id });
  const rohanEmp = await Employee.findOne({ user_id: rohanUser._id });
  const ananyaEmp = await Employee.findOne({ user_id: ananyaUser._id });
  const deepakEmp = await Employee.findOne({ user_id: deepakUser._id });
  const snehaEmp = await Employee.findOne({ user_id: snehaUser._id });
  const kavithaEmp = await Employee.findOne({ user_id: kavithaUser._id });

  // ═══════════════════════════════════════════════════════
  // 1. More Companies (client companies)
  // ═══════════════════════════════════════════════════════
  const newCompanies = await Company.insertMany([
    { name: "Reliance Digital Services", country: "india", address: "Navi Mumbai, Maharashtra", industry: "Telecommunications", is_internal: false },
    { name: "Infosys BPO", country: "india", address: "Electronic City, Bengaluru, Karnataka", industry: "IT Consulting", is_internal: false },
    { name: "Tata Motors Ltd.", country: "india", address: "Pimpri-Chinchwad, Pune, Maharashtra", industry: "Automobile", is_internal: false },
  ]);
  console.log("  ✓ 3 Client companies created");

  // ═══════════════════════════════════════════════════════
  // 2. More Departments + Teams (sub-departments)
  // ═══════════════════════════════════════════════════════
  const newDepts = await Department.insertMany([
    { name: "Quality Assurance", code: "QA", description: "Testing, QA automation, and quality control", color: "#ef4444" },
    { name: "DevOps", code: "DEVOPS", description: "Infrastructure, CI/CD, and cloud operations", color: "#06b6d4" },
    { name: "Finance", code: "FIN", description: "Accounting, payroll, and financial planning", color: "#84cc16" },
  ]);
  const [qaDept, devopsDept, finDept] = newDepts;

  // Teams (sub-departments under existing departments)
  const teams = await Department.insertMany([
    { name: "Frontend Team", code: "ENG-FE", description: "React, UI components, and frontend architecture", color: "#818cf8", type: "team", parent_department_id: engDept._id },
    { name: "Backend Team", code: "ENG-BE", description: "APIs, microservices, and database layer", color: "#34d399", type: "team", parent_department_id: engDept._id },
    { name: "Mobile Team", code: "ENG-MOB", description: "React Native and mobile app development", color: "#fb923c", type: "team", parent_department_id: engDept._id },
    { name: "Support — Tier 2", code: "CS-T2", description: "Escalated technical support tickets", color: "#22d3ee", type: "team", parent_department_id: csDept._id },
  ]);
  const [feTeam, beTeam, mobTeam, csT2Team] = teams;
  console.log("  ✓ 3 Departments + 4 Teams created");

  // ═══════════════════════════════════════════════════════
  // 3. More Employees (15 new — covering all departments)
  // ═══════════════════════════════════════════════════════
  const newEmpData = [
    // Engineering — more members
    { first: "Siddharth", last: "Chatterjee", email: "siddharth.chatterjee@eip.in", dept: engDept._id, pos: "engineer", type: "internal_team", phone: "+919812345021", teamLead: ananyaEmp._id },
    { first: "Nandini", last: "Deshmukh", email: "nandini.deshmukh@eip.in", dept: engDept._id, pos: "intern", type: "internal_team", phone: "+919812345022", teamLead: ananyaEmp._id },
    // QA
    { first: "Pooja", last: "Bhatt", email: "pooja.bhatt@eip.in", dept: qaDept._id, pos: "team_lead", type: "internal_team", phone: "+919812345023", teamLead: null },
    { first: "Rahul", last: "Saxena", email: "rahul.saxena@eip.in", dept: qaDept._id, pos: "engineer", type: "internal_team", phone: "+919812345024", teamLead: null /* set after pooja */ },
    { first: "Divya", last: "Pillai", email: "divya.pillai@eip.in", dept: qaDept._id, pos: "junior_engineer", type: "internal_team", phone: "+919812345025", teamLead: null },
    // DevOps
    { first: "Karthik", last: "Subramanian", email: "karthik.subramanian@eip.in", dept: devopsDept._id, pos: "team_lead", type: "internal_team", phone: "+919812345026", teamLead: null },
    { first: "Tanvi", last: "Agarwal", email: "tanvi.agarwal@eip.in", dept: devopsDept._id, pos: "senior_engineer", type: "internal_team", phone: "+919812345027", teamLead: null },
    // Finance
    { first: "Manish", last: "Tiwari", email: "manish.tiwari@eip.in", dept: finDept._id, pos: "team_lead", type: "internal_team", phone: "+919812345028", teamLead: null },
    { first: "Shruti", last: "Pandey", email: "shruti.pandey@eip.in", dept: finDept._id, pos: "engineer", type: "internal_team", phone: "+919812345029", teamLead: null },
    // Customer Support — more agents
    { first: "Aditya", last: "Kadam", email: "aditya.kadam@eip.in", dept: csDept._id, pos: null, type: "customer_support", phone: "+919812345030", teamLead: null },
    { first: "Neha", last: "Shetty", email: "neha.shetty@eip.in", dept: csDept._id, pos: null, type: "customer_support", phone: "+919812345031", teamLead: null },
    // Product — more members
    { first: "Gaurav", last: "Mishra", email: "gaurav.mishra@eip.in", dept: prodDept._id, pos: "engineer", type: "internal_team", phone: "+919812345032", teamLead: kavithaEmp._id },
    // HR — more members
    { first: "Aarti", last: "Chavan", email: "aarti.chavan@eip.in", dept: hrDept._id, pos: "engineer", type: "internal_team", phone: "+919812345033", teamLead: deepakEmp._id },
    // Design — more members
    { first: "Ishaan", last: "Bose", email: "ishaan.bose@eip.in", dept: desDept._id, pos: "junior_engineer", type: "internal_team", phone: "+919812345034", teamLead: snehaEmp._id },
    { first: "Ritika", last: "Malhotra", email: "ritika.malhotra@eip.in", dept: desDept._id, pos: "intern", type: "internal_team", phone: "+919812345035", teamLead: snehaEmp._id },
  ];

  const newEmpUsers = [];
  const newEmpRecords = [];

  for (const e of newEmpData) {
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
      company_id: existingCompany._id,
      last_login: pastDate(Math.floor(Math.random() * 10)),
    });
    newEmpUsers.push(user);
  }

  // Create employee records — handle team leads first, then set references
  // Engineering
  const siddharthEmp = await Employee.create({ user_id: newEmpUsers[0]._id, employee_type: "internal_team", department: engDept._id, position: "engineer", team_lead_id: ananyaEmp._id, hire_date: pastDate(120) });
  const nandiniEmp   = await Employee.create({ user_id: newEmpUsers[1]._id, employee_type: "internal_team", department: engDept._id, position: "intern", team_lead_id: ananyaEmp._id, hire_date: pastDate(30) });
  // QA — Pooja is TL
  const poojaEmp   = await Employee.create({ user_id: newEmpUsers[2]._id, employee_type: "internal_team", department: qaDept._id, position: "team_lead", hire_date: pastDate(280) });
  const rahulEmp   = await Employee.create({ user_id: newEmpUsers[3]._id, employee_type: "internal_team", department: qaDept._id, position: "engineer", team_lead_id: poojaEmp._id, hire_date: pastDate(200) });
  const divyaEmp   = await Employee.create({ user_id: newEmpUsers[4]._id, employee_type: "internal_team", department: qaDept._id, position: "junior_engineer", team_lead_id: poojaEmp._id, hire_date: pastDate(60) });
  // DevOps — Karthik is TL
  const karthikEmp = await Employee.create({ user_id: newEmpUsers[5]._id, employee_type: "internal_team", department: devopsDept._id, position: "team_lead", hire_date: pastDate(400) });
  const tanviEmp   = await Employee.create({ user_id: newEmpUsers[6]._id, employee_type: "internal_team", department: devopsDept._id, position: "senior_engineer", team_lead_id: karthikEmp._id, hire_date: pastDate(300) });
  // Finance — Manish is TL
  const manishEmp  = await Employee.create({ user_id: newEmpUsers[7]._id, employee_type: "internal_team", department: finDept._id, position: "team_lead", hire_date: pastDate(450) });
  const shrutiEmp  = await Employee.create({ user_id: newEmpUsers[8]._id, employee_type: "internal_team", department: finDept._id, position: "engineer", team_lead_id: manishEmp._id, hire_date: pastDate(200) });
  // Customer Support
  const adityaEmp  = await Employee.create({ user_id: newEmpUsers[9]._id, employee_type: "customer_support", department: csDept._id, hire_date: pastDate(150) });
  const nehaEmp    = await Employee.create({ user_id: newEmpUsers[10]._id, employee_type: "customer_support", department: csDept._id, hire_date: pastDate(100) });
  // Product
  const gauravEmp  = await Employee.create({ user_id: newEmpUsers[11]._id, employee_type: "internal_team", department: prodDept._id, position: "engineer", team_lead_id: kavithaEmp._id, hire_date: pastDate(160) });
  // HR
  const aartiEmp   = await Employee.create({ user_id: newEmpUsers[12]._id, employee_type: "internal_team", department: hrDept._id, position: "engineer", team_lead_id: deepakEmp._id, hire_date: pastDate(220) });
  // Design
  const ishaanEmp  = await Employee.create({ user_id: newEmpUsers[13]._id, employee_type: "internal_team", department: desDept._id, position: "junior_engineer", team_lead_id: snehaEmp._id, hire_date: pastDate(80) });
  const ritikaEmp  = await Employee.create({ user_id: newEmpUsers[14]._id, employee_type: "internal_team", department: desDept._id, position: "intern", team_lead_id: snehaEmp._id, hire_date: pastDate(20) });

  newEmpRecords.push(siddharthEmp, nandiniEmp, poojaEmp, rahulEmp, divyaEmp, karthikEmp, tanviEmp, manishEmp, shrutiEmp, adityaEmp, nehaEmp, gauravEmp, aartiEmp, ishaanEmp, ritikaEmp);

  // Set new department heads
  await Department.updateOne({ _id: qaDept._id }, { head_id: poojaEmp._id });
  await Department.updateOne({ _id: devopsDept._id }, { head_id: karthikEmp._id });
  await Department.updateOne({ _id: finDept._id }, { head_id: manishEmp._id });

  // Assign roles
  const newRoleAssignments = newEmpUsers.map((u, i) => {
    const isLead = [2, 5, 7].includes(i); // pooja, karthik, manish are TLs
    return { user_id: u._id, role_id: isLead ? tlRole._id : empRole._id, assigned_by: adminUser._id };
  });
  await UserRole.insertMany(newRoleAssignments);
  console.log("  ✓ 15 new Employees created");

  // ═══════════════════════════════════════════════════════
  // 4. More Customers (from client companies)
  // ═══════════════════════════════════════════════════════
  const newCustData = [
    { first: "Prakash", last: "Hegde", email: "prakash.hegde@reliance.com", phone: "+919812345041", custType: "business", sub: "Enterprise", compId: newCompanies[0]._id },
    { first: "Swati", last: "Jain", email: "swati.jain@infosys.com", phone: "+919812345042", custType: "business", sub: "Enterprise", compId: newCompanies[1]._id },
    { first: "Vijay", last: "Patil", email: "vijay.patil@tatamotors.com", phone: "+919812345043", custType: "business", sub: "Pro", compId: newCompanies[2]._id },
    { first: "Anita", last: "Kumari", email: "anita.kumari@gmail.com", phone: "+919812345044", custType: "individual", sub: "Starter", compId: existingCompany._id },
    { first: "Bharat", last: "Thakur", email: "bharat.thakur@hotmail.com", phone: "+919812345045", custType: "individual", sub: "Pro", compId: existingCompany._id },
  ];

  const newCustUsers = [];
  const newCustRecords = [];
  for (const c of newCustData) {
    const user = await User.create({
      email: c.email, password_hash: CUST_PW, user_type: "customer", status: "active",
      first_name: c.first, last_name: c.last, phone: c.phone,
      country: "india", timezone: "Asia/Kolkata", company_id: c.compId,
    });
    newCustUsers.push(user);
    const cust = await Customer.create({
      user_id: user._id,
      customer_type: c.custType,
      assigned_support_agent_id: [meeraEmp._id, rohanEmp._id, adityaEmp._id, nehaEmp._id][newCustUsers.length % 4],
      subscription_tier: c.sub,
      onboarding_status: "completed",
    });
    newCustRecords.push(cust);
  }
  console.log("  ✓ 5 new Customers created");

  // ═══════════════════════════════════════════════════════
  // 5. Department-wise chat channels + messages
  // ═══════════════════════════════════════════════════════

  // QA Team channel
  const qaChannel = await ChatChannel.create({ channel_type: "group", name: "QA Team", created_by: newEmpUsers[2]._id });
  await ChannelMember.insertMany([
    { channel_id: qaChannel._id, user_id: newEmpUsers[2]._id, role: "admin" },
    { channel_id: qaChannel._id, user_id: newEmpUsers[3]._id },
    { channel_id: qaChannel._id, user_id: newEmpUsers[4]._id },
  ]);

  // DevOps channel
  const devopsChannel = await ChatChannel.create({ channel_type: "group", name: "DevOps & Infra", created_by: newEmpUsers[5]._id });
  await ChannelMember.insertMany([
    { channel_id: devopsChannel._id, user_id: newEmpUsers[5]._id, role: "admin" },
    { channel_id: devopsChannel._id, user_id: newEmpUsers[6]._id },
    { channel_id: devopsChannel._id, user_id: vikramUser._id }, // Vikram also in devops channel
  ]);

  // Finance channel
  const finChannel = await ChatChannel.create({ channel_type: "group", name: "Finance & Accounts", created_by: newEmpUsers[7]._id });
  await ChannelMember.insertMany([
    { channel_id: finChannel._id, user_id: newEmpUsers[7]._id, role: "admin" },
    { channel_id: finChannel._id, user_id: newEmpUsers[8]._id },
    { channel_id: finChannel._id, user_id: adminUser._id },
  ]);

  // HR channel
  const hrChannel = await ChatChannel.create({ channel_type: "group", name: "HR & People Ops", created_by: deepakUser._id });
  await ChannelMember.insertMany([
    { channel_id: hrChannel._id, user_id: deepakUser._id, role: "admin" },
    { channel_id: hrChannel._id, user_id: newEmpUsers[12]._id }, // Aarti
    { channel_id: hrChannel._id, user_id: adminUser._id },
  ]);

  // Design channel
  const designChannel = await ChatChannel.create({ channel_type: "group", name: "Design Studio", created_by: snehaUser._id });
  await ChannelMember.insertMany([
    { channel_id: designChannel._id, user_id: snehaUser._id, role: "admin" },
    { channel_id: designChannel._id, user_id: raviUser._id },
    { channel_id: designChannel._id, user_id: newEmpUsers[13]._id }, // Ishaan
    { channel_id: designChannel._id, user_id: newEmpUsers[14]._id }, // Ritika
  ]);

  // Product channel
  const prodChannel = await ChatChannel.create({ channel_type: "group", name: "Product & Strategy", created_by: kavithaUser._id });
  await ChannelMember.insertMany([
    { channel_id: prodChannel._id, user_id: kavithaUser._id, role: "admin" },
    { channel_id: prodChannel._id, user_id: newEmpUsers[11]._id }, // Gaurav
    { channel_id: prodChannel._id, user_id: adminUser._id },
    { channel_id: prodChannel._id, user_id: snehaUser._id },
  ]);

  // Cross-team channel
  const crossTeamChannel = await ChatChannel.create({ channel_type: "group", name: "Tech Leads Sync", created_by: adminUser._id });
  await ChannelMember.insertMany([
    { channel_id: crossTeamChannel._id, user_id: adminUser._id, role: "admin" },
    { channel_id: crossTeamChannel._id, user_id: ananyaUser._id },
    { channel_id: crossTeamChannel._id, user_id: newEmpUsers[2]._id }, // Pooja
    { channel_id: crossTeamChannel._id, user_id: newEmpUsers[5]._id }, // Karthik
    { channel_id: crossTeamChannel._id, user_id: deepakUser._id },
    { channel_id: crossTeamChannel._id, user_id: snehaUser._id },
    { channel_id: crossTeamChannel._id, user_id: kavithaUser._id },
    { channel_id: crossTeamChannel._id, user_id: newEmpUsers[7]._id }, // Manish
  ]);

  // More DMs
  const dm1 = await ChatChannel.create({ channel_type: "direct", created_by: newEmpUsers[2]._id });
  await ChannelMember.insertMany([
    { channel_id: dm1._id, user_id: newEmpUsers[2]._id },
    { channel_id: dm1._id, user_id: ananyaUser._id },
  ]);

  const dm2 = await ChatChannel.create({ channel_type: "direct", created_by: newEmpUsers[5]._id });
  await ChannelMember.insertMany([
    { channel_id: dm2._id, user_id: newEmpUsers[5]._id },
    { channel_id: dm2._id, user_id: newEmpUsers[6]._id },
  ]);

  const dm3 = await ChatChannel.create({ channel_type: "direct", created_by: deepakUser._id });
  await ChannelMember.insertMany([
    { channel_id: dm3._id, user_id: deepakUser._id },
    { channel_id: dm3._id, user_id: newEmpUsers[12]._id }, // Aarti
  ]);

  // ── Messages for all new channels ──
  const allNewMessages = [
    // QA Team
    { ch: qaChannel._id, sender: newEmpUsers[2], content: "Team, we need to finish regression testing for v2.5 by Thursday", ago: 3 },
    { ch: qaChannel._id, sender: newEmpUsers[3], content: "I've automated 45 test cases for the payment module. Running them on Jenkins now", ago: 2.5 },
    { ch: qaChannel._id, sender: newEmpUsers[4], content: "Found 3 critical bugs in the checkout flow. Filing JIRAs now 🐛", ago: 2 },
    { ch: qaChannel._id, sender: newEmpUsers[2], content: "Good catch Divya! Tag Ananya's team for the fixes", ago: 1.5 },
    { ch: qaChannel._id, sender: newEmpUsers[3], content: "Selenium tests are passing on Chrome and Firefox. Safari has 2 failures", ago: 1 },
    { ch: qaChannel._id, sender: newEmpUsers[2], content: "Let's discuss Safari issues in tomorrow's standup. Good work everyone 👏", ago: 0.5 },

    // DevOps
    { ch: devopsChannel._id, sender: newEmpUsers[5], content: "AWS Mumbai region is showing high latency. Checking CloudWatch logs", ago: 4 },
    { ch: devopsChannel._id, sender: newEmpUsers[6], content: "I see it too. The RDS instance needs scaling. Should I upgrade to db.r5.xlarge?", ago: 3.5 },
    { ch: devopsChannel._id, sender: vikramUser, content: "The backend team is seeing timeouts on the /api/reports endpoint", ago: 3 },
    { ch: devopsChannel._id, sender: newEmpUsers[5], content: "Approved the RDS upgrade. Tanvi, schedule it for tonight's maintenance window (2 AM IST)", ago: 2.5 },
    { ch: devopsChannel._id, sender: newEmpUsers[6], content: "Done! Also updated Terraform configs and pushed to GitLab 🔧", ago: 2 },
    { ch: devopsChannel._id, sender: newEmpUsers[5], content: "Perfect. Vikram, the API should be faster after tonight. We're also adding Redis caching for that endpoint", ago: 1 },

    // Finance
    { ch: finChannel._id, sender: newEmpUsers[7], content: "Q3 financial statements are ready for review. Shared the Excel on the drive", ago: 5 },
    { ch: finChannel._id, sender: newEmpUsers[8], content: "GST filing for October is pending. Need invoices from 3 vendors in Pune", ago: 4 },
    { ch: finChannel._id, sender: adminUser, content: "Manish, can we schedule a budget review for Q1 2026? Need to plan for the Bengaluru office expansion", ago: 3 },
    { ch: finChannel._id, sender: newEmpUsers[7], content: "Absolutely Rajesh. I'll prepare the projections by next Monday. Shruti, can you pull the operational costs?", ago: 2 },
    { ch: finChannel._id, sender: newEmpUsers[8], content: "On it! Will also include the cloud infrastructure costs from Karthik's team", ago: 1.5 },

    // HR
    { ch: hrChannel._id, sender: deepakUser, content: "New joiners onboarding batch starts next Monday. 4 people joining across Engineering and QA 🎉", ago: 4 },
    { ch: hrChannel._id, sender: newEmpUsers[12], content: "ID cards and laptop requests are ready. IT team confirmed delivery by Friday", ago: 3.5 },
    { ch: hrChannel._id, sender: deepakUser, content: "Also planning a team outing for Holi. Budget approved ₹75,000", ago: 2 },
    { ch: hrChannel._id, sender: newEmpUsers[12], content: "Shall we book that resort in Lonavala again? Everyone loved it last year!", ago: 1.5 },
    { ch: hrChannel._id, sender: adminUser, content: "Great idea! Go ahead with Lonavala. Include transport from Gurugram office", ago: 1 },

    // Design
    { ch: designChannel._id, sender: snehaUser, content: "I've uploaded the new brand guidelines to Figma. Please review by EOD 🎨", ago: 3 },
    { ch: designChannel._id, sender: raviUser, content: "The color palette looks amazing! One suggestion — can we add a warm accent for the Indian market?", ago: 2.5 },
    { ch: designChannel._id, sender: newEmpUsers[13], content: "I've prototyped the mobile onboarding flow. 5 screens with micro-interactions", ago: 2 },
    { ch: designChannel._id, sender: newEmpUsers[14], content: "Working on illustrations for the empty states. Using Procreate + Figma workflow", ago: 1.5 },
    { ch: designChannel._id, sender: snehaUser, content: "Brilliant work Ishaan & Ritika! Let's present these in the design review on Thursday", ago: 1 },

    // Product
    { ch: prodChannel._id, sender: kavithaUser, content: "User research insights from the Chennai pilot are in. 87% satisfaction rate! 📊", ago: 4 },
    { ch: prodChannel._id, sender: newEmpUsers[11], content: "That's amazing! The multi-language support was the #1 requested feature", ago: 3.5 },
    { ch: prodChannel._id, sender: snehaUser, content: "Design team can start on Hindi and Tamil UI mockups next week", ago: 3 },
    { ch: prodChannel._id, sender: kavithaUser, content: "Let's plan a cross-functional meeting with Engineering to discuss the i18n architecture", ago: 2 },
    { ch: prodChannel._id, sender: adminUser, content: "This is a priority. Gaurav, draft the PRD and share with all tech leads by Friday", ago: 1 },

    // Tech Leads Sync
    { ch: crossTeamChannel._id, sender: adminUser, content: "Good morning leads! Quick sync — any blockers for this week?", ago: 2 },
    { ch: crossTeamChannel._id, sender: ananyaUser, content: "Engineering is on track. 2 PRs waiting for QA review @Pooja", ago: 1.8 },
    { ch: crossTeamChannel._id, sender: newEmpUsers[2], content: "We'll pick those up today Ananya. QA pipeline is clear now", ago: 1.5 },
    { ch: crossTeamChannel._id, sender: newEmpUsers[5], content: "DevOps: RDS upgrade tonight. Brief downtime expected 2-3 AM IST", ago: 1.2 },
    { ch: crossTeamChannel._id, sender: kavithaUser, content: "Product: Hindi/Tamil localization PRD coming Friday. Need eng estimation next week", ago: 1 },
    { ch: crossTeamChannel._id, sender: newEmpUsers[7], content: "Finance: Q1 budget drafts ready for dept heads. Check your email 📧", ago: 0.8 },
    { ch: crossTeamChannel._id, sender: deepakUser, content: "HR update: 4 new joiners Monday. Buddy assignments needed from each team lead", ago: 0.5 },
    { ch: crossTeamChannel._id, sender: snehaUser, content: "Design: Brand guidelines v2 published. Everyone please use the new color tokens", ago: 0.3 },

    // DM — Pooja & Ananya
    { ch: dm1._id, sender: newEmpUsers[2], content: "Hey Ananya, the login module has a session timeout bug. Can your team look at it?", ago: 1.5 },
    { ch: dm1._id, sender: ananyaUser, content: "Sure Pooja! I'll assign it to Siddharth. Can you share the test case ID?", ago: 1.2 },
    { ch: dm1._id, sender: newEmpUsers[2], content: "TC-2024-0891. Happens when user is idle for exactly 15 minutes on Safari", ago: 1 },
    { ch: dm1._id, sender: ananyaUser, content: "Got it. Siddharth will have a fix by tomorrow 🫡", ago: 0.8 },

    // DM — Karthik & Tanvi
    { ch: dm2._id, sender: newEmpUsers[5], content: "Tanvi, the Kubernetes pods in ap-south-1 are restarting frequently. Can you check?", ago: 2 },
    { ch: dm2._id, sender: newEmpUsers[6], content: "Checking now... Looks like OOM kills. Memory limit is too low for the new ML service", ago: 1.5 },
    { ch: dm2._id, sender: newEmpUsers[5], content: "Increase to 4Gi and add HPA. Also set up PagerDuty alerts for memory > 80%", ago: 1 },
    { ch: dm2._id, sender: newEmpUsers[6], content: "Done and deployed! Also documented the change in Confluence 📝", ago: 0.5 },

    // DM — Deepak & Aarti
    { ch: dm3._id, sender: deepakUser, content: "Aarti, can you prepare offer letters for the 4 new joiners? Details in the shared folder", ago: 3 },
    { ch: dm3._id, sender: newEmpUsers[12], content: "Already on it! 2 are done. Waiting for CTC confirmation from Finance for the other 2", ago: 2.5 },
    { ch: dm3._id, sender: deepakUser, content: "I'll ping Manish to expedite. Also please schedule their Day 1 orientations", ago: 2 },
    { ch: dm3._id, sender: newEmpUsers[12], content: "Orientation slots booked for Monday 10 AM. Welcome kits ordered from Gurugram vendor 🎁", ago: 1 },
  ];

  for (const m of allNewMessages) {
    await Message.create({
      channel_id: m.ch,
      sender_id: m.sender._id,
      content: m.content,
      message_type: "text",
      created_at: pastDate(m.ago),
    });
  }
  console.log("  ✓ 8 new Channels + 56 messages created");

  // ═══════════════════════════════════════════════════════
  // 6. More Meetings
  // ═══════════════════════════════════════════════════════
  await Meeting.insertMany([
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "QA Regression Review",
      description: "Review regression test results for v2.5 release",
      host_id: newEmpUsers[2]._id,
      participants: [newEmpUsers[2]._id, newEmpUsers[3]._id, newEmpUsers[4]._id, ananyaUser._id],
      meeting_type: "internal",
      scheduled_at: futureDate(1),
      duration_minutes: 45,
      status: "scheduled",
      open_to_everyone: false,
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "DevOps Infrastructure Planning",
      description: "AWS cost optimization and scaling strategy for Q1",
      host_id: newEmpUsers[5]._id,
      participants: [newEmpUsers[5]._id, newEmpUsers[6]._id, vikramUser._id, adminUser._id],
      meeting_type: "internal",
      scheduled_at: futureDate(2),
      duration_minutes: 60,
      status: "scheduled",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Q1 Budget Review — Finance",
      description: "Review and finalize Q1 FY2026 budget allocations",
      host_id: newEmpUsers[7]._id,
      participants: [newEmpUsers[7]._id, newEmpUsers[8]._id, adminUser._id],
      meeting_type: "internal",
      scheduled_at: futureDate(4),
      duration_minutes: 60,
      status: "scheduled",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Reliance Integration Kickoff",
      description: "Technical kickoff for Reliance Digital Services API integration",
      host_id: kavithaUser._id,
      participants: [kavithaUser._id, ananyaUser._id, newEmpUsers[5]._id, newCustUsers[0]._id],
      meeting_type: "customer_consultation",
      scheduled_at: futureDate(3),
      duration_minutes: 60,
      status: "scheduled",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Infosys Quarterly Business Review",
      description: "QBR with Infosys BPO team — support metrics and SLA review",
      host_id: meeraUser._id,
      participants: [meeraUser._id, newEmpUsers[9]._id, newCustUsers[1]._id],
      meeting_type: "customer_consultation",
      scheduled_at: futureDate(6),
      duration_minutes: 45,
      status: "scheduled",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Cross-Team Design Review",
      description: "Review design system v2 updates with all stakeholders",
      host_id: snehaUser._id,
      participants: [snehaUser._id, raviUser._id, newEmpUsers[13]._id, newEmpUsers[14]._id, kavithaUser._id, ananyaUser._id],
      meeting_type: "internal",
      scheduled_at: futureDate(2),
      duration_minutes: 45,
      status: "scheduled",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "New Joiners Orientation",
      description: "Day 1 orientation for new employees joining across Engineering and QA",
      host_id: deepakUser._id,
      participants: [deepakUser._id, newEmpUsers[12]._id, adminUser._id],
      meeting_type: "internal",
      scheduled_at: futureDate(1),
      duration_minutes: 120,
      status: "scheduled",
      open_to_everyone: false,
    },
    // Past meetings
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "AWS Cost Optimization Workshop",
      description: "Workshop on reducing cloud infrastructure costs by 30%",
      host_id: newEmpUsers[5]._id,
      participants: [newEmpUsers[5]._id, newEmpUsers[6]._id, vikramUser._id, newEmpUsers[7]._id],
      meeting_type: "internal",
      scheduled_at: pastDate(3),
      started_at: pastDate(3),
      ended_at: new Date(pastDate(3).getTime() + 90 * 60000),
      duration_minutes: 90,
      status: "ended",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Tata Motors Support Escalation Review",
      description: "Review of escalated support tickets from Tata Motors",
      host_id: meeraUser._id,
      participants: [meeraUser._id, rohanUser._id, newEmpUsers[9]._id, newCustUsers[2]._id],
      meeting_type: "support",
      scheduled_at: pastDate(7),
      started_at: pastDate(7),
      ended_at: new Date(pastDate(7).getTime() + 30 * 60000),
      duration_minutes: 30,
      status: "ended",
    },
    {
      meeting_code: `MEET-${randomCode()}`,
      title: "Holi Celebration Planning",
      description: "Plan the office Holi event — venue, activities, and budget",
      host_id: deepakUser._id,
      participants: [deepakUser._id, newEmpUsers[12]._id, snehaUser._id, kavithaUser._id],
      meeting_type: "internal",
      scheduled_at: pastDate(4),
      started_at: pastDate(4),
      ended_at: new Date(pastDate(4).getTime() + 40 * 60000),
      duration_minutes: 40,
      status: "ended",
    },
  ]);
  console.log("  ✓ 10 new Meetings created");

  // ═══════════════════════════════════════════════════════
  // 7. More Support Tickets
  // ═══════════════════════════════════════════════════════
  const newTickets = await SupportTicket.insertMany([
    {
      ticket_number: "TKT-2024-006",
      customer_id: newCustRecords[0]._id,
      assigned_agent_id: meeraEmp._id,
      title: "API rate limiting issues",
      description: "Our integration is hitting rate limits at 50 req/min. We need at least 200 req/min for production.",
      priority: "high",
      status: "in_progress",
      category: "Technical",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-007",
      customer_id: newCustRecords[1]._id,
      assigned_agent_id: adityaEmp._id,
      title: "SSO integration not working",
      description: "SAML SSO with our Okta instance returns 403 after redirect. Worked fine until the last update.",
      priority: "critical",
      status: "open",
      category: "Authentication",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-008",
      customer_id: newCustRecords[2]._id,
      assigned_agent_id: rohanEmp._id,
      title: "Need Hindi language support",
      description: "Our factory floor workers prefer Hindi. Can you add Hindi localization to the dashboard?",
      priority: "medium",
      status: "open",
      category: "Feature Request",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-009",
      customer_id: newCustRecords[3]._id,
      assigned_agent_id: nehaEmp._id,
      title: "Slow dashboard loading",
      description: "Dashboard takes 15+ seconds to load since yesterday. Other pages are fine.",
      priority: "high",
      status: "in_progress",
      category: "Performance",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-010",
      customer_id: newCustRecords[4]._id,
      assigned_agent_id: adityaEmp._id,
      title: "Invoice download fails on mobile",
      description: "Trying to download invoices from mobile Chrome. The download starts but the file is 0 bytes.",
      priority: "low",
      status: "pending",
      category: "Bug Report",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-011",
      customer_id: newCustRecords[0]._id,
      assigned_agent_id: meeraEmp._id,
      collaborators: [adityaEmp._id, karthikEmp._id],
      title: "Webhook delivery failures",
      description: "50% of our webhook events are failing with timeout. We receive them on AWS Lambda in ap-south-1.",
      priority: "critical",
      status: "in_progress",
      category: "Technical",
      country: "india",
    },
    {
      ticket_number: "TKT-2024-012",
      customer_id: newCustRecords[1]._id,
      assigned_agent_id: rohanEmp._id,
      title: "Upgrade plan from Pro to Enterprise",
      description: "We'd like to upgrade to Enterprise plan. Please share the pricing and migration path.",
      priority: "low",
      status: "resolved",
      category: "Billing",
      country: "india",
      resolved_at: pastDate(2),
    },
  ]);

  // Ticket messages for new tickets
  await TicketMessage.insertMany([
    { ticket_id: newTickets[0]._id, sender_id: newCustUsers[0]._id, content: "This is blocking our production deployment. Please prioritize." },
    { ticket_id: newTickets[0]._id, sender_id: meeraUser._id, content: "Namaste Prakash ji, I've raised this with our DevOps team. Karthik is looking into increasing the rate limit for Enterprise accounts." },
    { ticket_id: newTickets[0]._id, sender_id: meeraUser._id, content: "Update: Rate limit increased to 500 req/min for your API key. Please test and confirm." },

    { ticket_id: newTickets[1]._id, sender_id: newCustUsers[1]._id, content: "Here's the SAML trace log from Okta: [attached]. Error occurs at step 4 of the flow." },
    { ticket_id: newTickets[1]._id, sender_id: newEmpUsers[9]._id, content: "Thank you Swati ji. I can see the issue — the assertion consumer URL changed in our last release. Deploying a hotfix now." },

    { ticket_id: newTickets[3]._id, sender_id: newCustUsers[3]._id, content: "It's still slow as of this morning. Any update?" },
    { ticket_id: newTickets[3]._id, sender_id: newEmpUsers[10]._id, content: "We identified the issue — a missing database index on the analytics table. Fix is being deployed now." },
    { ticket_id: newTickets[3]._id, sender_id: newEmpUsers[10]._id, content: "Index deployed. Dashboard load time should be under 2 seconds now. Please check and confirm 🙏" },

    { ticket_id: newTickets[5]._id, sender_id: newCustUsers[0]._id, content: "Our Lambda function has a 10 second timeout. Are your webhooks retrying?" },
    { ticket_id: newTickets[5]._id, sender_id: meeraUser._id, content: "We retry 3 times with exponential backoff. However, I've looped in Karthik from DevOps to investigate latency from our end." },
    { ticket_id: newTickets[5]._id, sender_id: newEmpUsers[5]._id, content: "Found it — our webhook queue in Mumbai was backed up due to a Redis memory issue. Cleared and scaled up. Delivery rate should be 99%+ now." },
  ]);
  console.log("  ✓ 7 new Support tickets + 11 messages created");

  // ═══════════════════════════════════════════════════════
  // 8. More Files
  // ═══════════════════════════════════════════════════════
  await File.insertMany([
    {
      file_name: "QA_Test_Report_v2.5.pdf",
      file_type: "application/pdf", file_size: 1234567,
      storage_path: "files/qa-test-report-v25.pdf",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/qa-test-report-v25.pdf",
      uploaded_by: newEmpUsers[2]._id,
      uploader_info: { name: "Pooja Bhatt", email: "pooja.bhatt@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [ananyaUser._id, newEmpUsers[3]._id, newEmpUsers[4]._id], department: "Quality Assurance" },
      metadata: { description: "Regression test report for v2.5 release", tags: ["qa", "testing", "release"], category: "Reports" },
    },
    {
      file_name: "AWS_Architecture_Diagram.png",
      file_type: "image/png", file_size: 567890,
      storage_path: "files/aws-architecture.png",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/aws-architecture.png",
      uploaded_by: newEmpUsers[5]._id,
      uploader_info: { name: "Karthik Subramanian", email: "karthik.subramanian@eip.in" },
      country: "india",
      permissions: { is_public: true, user_ids: [], department: null },
      metadata: { description: "Current AWS infrastructure architecture diagram", tags: ["devops", "aws", "architecture"], category: "Technical" },
    },
    {
      file_name: "Q1_Budget_Projections.xlsx",
      file_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", file_size: 345678,
      storage_path: "files/q1-budget-projections.xlsx",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/q1-budget-projections.xlsx",
      uploaded_by: newEmpUsers[7]._id,
      uploader_info: { name: "Manish Tiwari", email: "manish.tiwari@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [adminUser._id, newEmpUsers[8]._id], department: "Finance" },
      metadata: { description: "Q1 FY2026 budget projections for all departments", tags: ["finance", "budget", "quarterly"], category: "Finance" },
    },
    {
      file_name: "Brand_Guidelines_V2.pdf",
      file_type: "application/pdf", file_size: 6789012,
      storage_path: "files/brand-guidelines-v2.pdf",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/brand-guidelines-v2.pdf",
      uploaded_by: snehaUser._id,
      uploader_info: { name: "Sneha Kulkarni", email: "sneha.kulkarni@eip.in" },
      country: "india",
      permissions: { is_public: true, user_ids: [], department: null },
      metadata: { description: "TechVista brand guidelines v2 — logo, colors, typography", tags: ["design", "brand", "guidelines"], category: "Design" },
    },
    {
      file_name: "Onboarding_Checklist_Template.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", file_size: 89012,
      storage_path: "files/onboarding-checklist.docx",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/onboarding-checklist.docx",
      uploaded_by: deepakUser._id,
      uploader_info: { name: "Deepak Singh", email: "deepak.singh@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [newEmpUsers[12]._id, adminUser._id], department: "Human Resources" },
      metadata: { description: "Template for new employee onboarding process", tags: ["hr", "onboarding", "template"], category: "HR" },
    },
    {
      file_name: "Product_PRD_Localization.pdf",
      file_type: "application/pdf", file_size: 456789,
      storage_path: "files/prd-localization.pdf",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/prd-localization.pdf",
      uploaded_by: newEmpUsers[11]._id,
      uploader_info: { name: "Gaurav Mishra", email: "gaurav.mishra@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [kavithaUser._id, ananyaUser._id, snehaUser._id], department: "Product" },
      metadata: { description: "PRD for Hindi and Tamil localization feature", tags: ["product", "localization", "i18n"], category: "Product" },
    },
    {
      file_name: "Terraform_Configs_v3.zip",
      file_type: "application/zip", file_size: 234567,
      storage_path: "files/terraform-configs-v3.zip",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/terraform-configs-v3.zip",
      uploaded_by: newEmpUsers[6]._id,
      uploader_info: { name: "Tanvi Agarwal", email: "tanvi.agarwal@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [newEmpUsers[5]._id, vikramUser._id], department: "DevOps" },
      metadata: { description: "Terraform infrastructure configs for Mumbai and Chennai regions", tags: ["devops", "terraform", "infrastructure"], category: "Technical" },
    },
    {
      file_name: "GST_Filing_October_2025.pdf",
      file_type: "application/pdf", file_size: 178901,
      storage_path: "files/gst-filing-oct-2025.pdf",
      storage_url: "https://res.cloudinary.com/demo/raw/upload/v1/files/gst-filing-oct-2025.pdf",
      uploaded_by: newEmpUsers[8]._id,
      uploader_info: { name: "Shruti Pandey", email: "shruti.pandey@eip.in" },
      country: "india",
      permissions: { is_public: false, user_ids: [newEmpUsers[7]._id, adminUser._id], department: "Finance" },
      metadata: { description: "GST filing documents for October 2025", tags: ["finance", "gst", "tax"], category: "Finance" },
    },
  ]);
  console.log("  ✓ 8 new Files created");

  // ═══════════════════════════════════════════════════════
  // 9. More Documents
  // ═══════════════════════════════════════════════════════
  const newDocs = [
    {
      title: "QA Test Strategy — v2.5 Release",
      content: `# QA Test Strategy — v2.5 Release

## Scope
- Payment module (Razorpay + UPI integration)
- Dashboard performance improvements
- Mobile responsive fixes
- Hindi localization (pilot)

## Test Types
1. **Functional Testing** — All user stories in Sprint 47-49
2. **Regression Testing** — 150 automated test cases
3. **Performance Testing** — Load test with 1000 concurrent users
4. **Security Testing** — OWASP Top 10 scan
5. **UAT** — 5 beta customers from Bengaluru and Mumbai

## Environment
- Staging: staging.techvista.in (Pune data center)
- Test DB: MongoDB Atlas (Mumbai cluster, test namespace)
- CI: Jenkins pipeline — auto-trigger on PR merge

## Timeline
| Phase | Start | End |
|-------|-------|-----|
| Test planning | Mar 1 | Mar 3 |
| Test execution | Mar 4 | Mar 10 |
| Bug fixing | Mar 11 | Mar 14 |
| Regression rerun | Mar 15 | Mar 16 |
| Sign-off | Mar 17 | Mar 17 |

## Team
- Pooja Bhatt (Lead)
- Rahul Saxena (Automation)
- Divya Pillai (Manual + Mobile)

_Created by Pooja Bhatt_`,
      owner: newEmpUsers[2]._id,
      collaborators: [
        { user: newEmpUsers[3]._id, access: "write" },
        { user: newEmpUsers[4]._id, access: "write" },
        { user: ananyaUser._id, access: "read" },
      ],
      is_public: false,
    },
    {
      title: "DevOps Runbook — Production Incidents",
      content: `# DevOps Runbook — Production Incidents

## Incident Severity Levels
| Level | Description | Response Time |
|-------|------------|---------------|
| P1 | Service down | 15 minutes |
| P2 | Major feature broken | 1 hour |
| P3 | Minor issue | 4 hours |
| P4 | Cosmetic / low impact | Next business day |

## On-Call Rotation
- Week 1: Karthik Subramanian
- Week 2: Tanvi Agarwal
- Week 3: Vikram Patel
- Week 4: (rotate back)

## Common Runbook Steps

### High CPU on API Pods
1. Check: \`kubectl top pods -n production\`
2. Scale: \`kubectl scale deployment api --replicas=5\`
3. Investigate: Check recent deployments, query patterns
4. Notify: #devops-alerts Slack channel

### Database Connection Pool Exhaustion
1. Check: MongoDB Atlas → Metrics → Connections
2. Restart: Roll restart API pods one by one
3. Root cause: Likely missing connection close in code
4. Fix: PR to engineering team

### Redis Memory Full
1. Check: \`redis-cli INFO memory\`
2. Flush expired keys: \`redis-cli --scan --pattern "cache:*" | xargs redis-cli DEL\`
3. Scale: Upgrade ElastiCache node type
4. Alert threshold: Set at 80% memory

## Escalation
1. On-call engineer (PagerDuty)
2. Karthik Subramanian (DevOps Lead)
3. Rajesh Sharma (Admin)

_Maintained by DevOps Team — Karthik & Tanvi_`,
      owner: newEmpUsers[5]._id,
      collaborators: [
        { user: newEmpUsers[6]._id, access: "write" },
        { user: vikramUser._id, access: "write" },
        { user: adminUser._id, access: "read" },
      ],
      is_public: false,
    },
    {
      title: "Finance — Q1 FY2026 Budget Plan",
      content: `# Q1 FY2026 Budget Plan — TechVista Solutions

## Revenue Projections
| Source | Amount (₹) |
|--------|-----------|
| SaaS Subscriptions | 45,00,000 |
| Enterprise Contracts | 25,00,000 |
| Professional Services | 10,00,000 |
| **Total Revenue** | **80,00,000** |

## Department-wise Budget Allocation
| Department | Q1 Budget (₹) | YoY Change |
|------------|---------------|------------|
| Engineering | 18,00,000 | +15% |
| Customer Support | 8,00,000 | +10% |
| Product | 6,00,000 | +5% |
| Design | 5,00,000 | +20% |
| HR | 4,00,000 | +8% |
| QA | 7,00,000 | NEW |
| DevOps | 12,00,000 | +25% |
| Finance | 3,00,000 | +5% |
| **Total OpEx** | **63,00,000** | |

## Key Investments
1. **Bengaluru Office** — ₹15,00,000 (new co-working space for 30 people)
2. **AWS Infrastructure** — ₹8,00,000 (Mumbai + Chennai regions)
3. **Hiring** — 8 new positions across Engineering, QA, and DevOps
4. **Training** — ₹2,00,000 (AWS certifications, React conference attendance)

## Notes
- GST filing deadline: 20th of each month
- Vendor payments: Net 30 terms
- Salary disbursement: 1st of each month via NEFT

_Prepared by Manish Tiwari & Shruti Pandey_`,
      owner: newEmpUsers[7]._id,
      collaborators: [
        { user: newEmpUsers[8]._id, access: "write" },
        { user: adminUser._id, access: "read" },
      ],
      is_public: false,
    },
    {
      title: "HR — Employee Onboarding Guide",
      content: `# Employee Onboarding Guide — TechVista Solutions

## Pre-joining (1 week before)
- [ ] Send offer letter and appointment letter
- [ ] Collect documents: Aadhaar, PAN, bank details, passport photos
- [ ] Create email account (IT team)
- [ ] Order laptop and accessories
- [ ] Assign buddy from same department
- [ ] Book orientation slot

## Day 1
- [ ] Welcome kit handover (bag, notebook, t-shirt, mug)
- [ ] Office tour — Cyber City, Gurugram campus
- [ ] HR orientation (policies, leave, benefits)
- [ ] Lunch with buddy
- [ ] IT setup — laptop, VPN, access cards
- [ ] Introduce to team and department head

## Week 1
- [ ] Department-specific onboarding sessions
- [ ] Access to tools: Jira, Figma, GitHub, Confluence, Slack
- [ ] Complete compliance training (data privacy, security)
- [ ] 1:1 with manager — set 30-60-90 day goals
- [ ] Team lunch / chai break outing

## Month 1
- [ ] Complete first small project/task
- [ ] Attend weekly team standup
- [ ] Feedback session with HR
- [ ] Probation review date set

## Benefits Overview
- Health insurance: ₹5,00,000 (self + family)
- Meal card: ₹3,000/month (Sodexo)
- WFH allowance: ₹2,500/month
- Learning budget: ₹25,000/year
- Annual retreat (all-expenses-paid company trip)

_Maintained by Deepak Singh & Aarti Chavan_`,
      owner: deepakUser._id,
      collaborators: [
        { user: newEmpUsers[12]._id, access: "write" },
        { user: adminUser._id, access: "read" },
      ],
      is_public: true,
    },
    {
      title: "Product Localization — Hindi & Tamil PRD",
      content: `# Product Localization PRD — Hindi & Tamil

## Background
87% satisfaction rate from Chennai pilot. #1 feature request: regional language support.
Target markets: Tier 2 & Tier 3 cities in India.

## Goals
1. Support Hindi (hi-IN) and Tamil (ta-IN) in the customer dashboard
2. RTL layout not needed (both are LTR scripts)
3. 95%+ UI string coverage
4. Dynamic language switching without page reload

## Technical Approach
- Use react-i18next for frontend translations
- JSON translation files per locale
- Backend error messages: i18n middleware with accept-language header
- Date/currency formatting: Intl API with locale parameter
- Font: Noto Sans Devanagari (Hindi), Noto Sans Tamil

## Screens to Localize (Priority Order)
1. Login / Signup
2. Dashboard home
3. Ticket creation & detail
4. Settings / Profile
5. Help center

## Timeline
| Milestone | Date |
|-----------|------|
| PRD approval | Mar 14 |
| Translation vendor onboarding | Mar 18 |
| Engineering implementation | Mar 21 — Apr 4 |
| QA with native speakers | Apr 7 — Apr 11 |
| Beta rollout (Chennai + Hyderabad) | Apr 14 |
| GA release | Apr 28 |

## Stakeholders
- Kavitha Iyer (Product Owner)
- Gaurav Mishra (Product)
- Ananya Verma (Engineering)
- Sneha Kulkarni (Design)
- Pooja Bhatt (QA)

_Created by Gaurav Mishra_`,
      owner: newEmpUsers[11]._id,
      collaborators: [
        { user: kavithaUser._id, access: "write" },
        { user: ananyaUser._id, access: "read" },
        { user: snehaUser._id, access: "read" },
        { user: newEmpUsers[2]._id, access: "read" },
      ],
      is_public: false,
    },
  ];

  for (const d of newDocs) {
    await Document.create(d);
  }
  console.log("  ✓ 5 new Documents created");

  // ═══════════════════════════════════════════════════════
  // Done
  // ═══════════════════════════════════════════════════════
  console.log("\n✅ Additional seed complete! New data added:");
  console.log("   • 3 Client companies (Reliance, Infosys, Tata Motors)");
  console.log("   • 3 Departments (QA, DevOps, Finance) + 4 Teams");
  console.log("   • 15 new Employees");
  console.log("   • 5 new Customers");
  console.log("   • 8 new Chat channels + 56 messages");
  console.log("   • 10 new Meetings");
  console.log("   • 7 new Support tickets + 11 ticket messages");
  console.log("   • 8 new Files");
  console.log("   • 5 new Documents");
  console.log("\n   New employee logins:");
  newEmpData.forEach((e) => console.log(`     ${e.email} / Employee@123`));
  console.log("\n   New customer logins:");
  newCustData.forEach((c) => console.log(`     ${c.email} / Customer@123`));
  console.log("\n   Total now: ~26 employees, ~8 customers, ~8 departments + 4 teams");

  await mongoose.disconnect();
  process.exit(0);
}

seedMore().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
