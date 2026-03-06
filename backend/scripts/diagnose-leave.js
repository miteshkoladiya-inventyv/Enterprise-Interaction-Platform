import "../env.js";
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI);

const LB = mongoose.model("LBDiag", new mongoose.Schema({}, { strict: false, collection: "leavebalances" }));

const all = await LB.find({}).lean();
const byEmp = {};
all.forEach(r => {
  const eid = r.employee_id.toString();
  if (!byEmp[eid]) byEmp[eid] = [];
  byEmp[eid].push(r.leave_type + ":" + r.allocated);
});

Object.entries(byEmp).forEach(([eid, types]) => {
  console.log(eid.slice(-6), "->", types.join(", "));
});

console.log("\nTotal employees:", Object.keys(byEmp).length);
console.log("Total records:", all.length);

await mongoose.disconnect();
process.exit(0);
