import "../env.js";
import mongoose from "mongoose";
import MeetingRecording from "../models/MeetingRecording.js";

await mongoose.connect(process.env.MONGODB_URI);
const recs = await MeetingRecording.find({}).select("_id meeting_id transcription_status transcript duration_seconds").lean();
console.log("Total recordings:", recs.length);
for (const r of recs) {
  console.log(
    "  ID:", String(r._id),
    "| Status:", r.transcription_status || "undefined",
    "| Has transcript:", !!r.transcript,
    "| Duration:", r.duration_seconds, "s"
  );
}
await mongoose.disconnect();
process.exit(0);
