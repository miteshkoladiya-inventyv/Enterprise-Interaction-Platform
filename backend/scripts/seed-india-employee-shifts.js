import "../env.js";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

const explicitShiftMap = {
  "ananya.verma@eip.in": "day",
  "vikram.patel@eip.in": "night",
  "priya.nair@eip.in": "night",
  "arjun.reddy@eip.in": "day",
  "meera.joshi@eip.in": "night",
  "rohan.gupta@eip.in": "night",
  "kavitha.iyer@eip.in": "day",
  "deepak.singh@eip.in": "day",
  "sneha.kulkarni@eip.in": "day",
  "ravi.menon@eip.in": "night",
};

const inferShift = (employee, email) => {
  if (explicitShiftMap[email]) return explicitShiftMap[email];
  if (employee.employee_type === "customer_support") return "night";
  if (["senior_engineer", "engineer"].includes(employee.position)) return "night";
  return "day";
};

async function run() {
  await connectDB();
  console.log("Connected. Updating India employee shifts (additive, no deletions)...");

  const employees = await Employee.find({ is_active: true })
    .populate("user_id", "email country")
    .lean();

  const indiaEmployees = employees.filter(
    (employee) => employee.user_id?.country === "india"
  );

  let updated = 0;
  let skipped = 0;

  for (const employee of indiaEmployees) {
    const email = employee.user_id?.email || "";
    const nextShift = inferShift(employee, email);

    if (employee.shift_type === nextShift) {
      skipped += 1;
      continue;
    }

    await Employee.updateOne(
      { _id: employee._id },
      { $set: { shift_type: nextShift } }
    );
    updated += 1;
    console.log(`SHIFT ${email} -> ${nextShift}`);
  }

  console.log("Done.");
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (error) => {
  console.error("India shift seed failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
