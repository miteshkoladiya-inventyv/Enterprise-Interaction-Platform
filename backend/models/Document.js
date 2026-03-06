import mongoose from "mongoose";
import crypto from "crypto";

const CollaboratorSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    access:   { type: String, enum: ["read", "write"], default: "read" },
    added_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DocumentSchema = new mongoose.Schema(
  {
    title:   { type: String, default: "Untitled document" },
    content: { type: String, default: "" },
    owner:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Each entry: { user: ObjectId, access: "read"|"write", added_at: Date }
    collaborators: [CollaboratorSchema],

    is_public:    { type: Boolean, default: false },
    share_token:  { type: String, unique: true, sparse: true },
    last_edited_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    created_at:   { type: Date, default: Date.now },
    updated_at:   { type: Date, default: Date.now },
  },
  { timestamps: false }
);

DocumentSchema.pre("save", function () {
  this.updated_at = Date.now();
  if (!this.share_token) {
    this.share_token = crypto.randomBytes(16).toString("hex");
  }
});

DocumentSchema.index({ owner: 1 });
DocumentSchema.index({ "collaborators.user": 1 });
DocumentSchema.index({ share_token: 1 });

const Document = mongoose.model("Document", DocumentSchema);
export default Document;