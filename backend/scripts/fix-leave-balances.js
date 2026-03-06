import "../env.js";
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI);

const LB = mongoose.model("LBFix", new mongoose.Schema({}, { strict: false, collection: "leavebalances" }));

// Delete all existing records - ensureLeaveBalance will recreate them properly on next API call
const result = await LB.deleteMany({});
console.log("Deleted", result.deletedCount, "leave balance records");
console.log("They will be recreated with all 4 types (paid:21, floater:2, marriage:15, unpaid:0) on next API hit per employee");

await mongoose.disconnect();
process.exit(0);
