import { Schema, model } from "mongoose";

const meetingRecordingSchema = new Schema(
  {
    meeting_id: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    participant_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participant_name: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["video", "audio", "screen"],
      required: true,
    },
    cloudinary_url: {
      type: String,
      required: true,
    },
    cloudinary_public_id: {
      type: String,
      required: true,
    },
    started_at: {
      type: Date,
      required: true,
    },
    ended_at: {
      type: Date,
      required: true,
    },
    duration_seconds: {
      type: Number,
      min: 0,
    },
    transcript: {
      type: String,
      default: null,
    },
    transcript_segments: {
      type: [
        {
          start: Number,
          end: Number,
          text: String,
        },
      ],
      default: [],
    },
    meeting_notes: {
      type: String,
      default: null,
    },
    transcription_status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

meetingRecordingSchema.index({ meeting_id: 1 });
meetingRecordingSchema.index({ participant_id: 1 });

export default model("MeetingRecording", meetingRecordingSchema);
