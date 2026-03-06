import crypto from "crypto";
import Whiteboard from "../../models/Whiteboard.js";

function generateSessionCode() {
  return "WB-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

// ─── Create ──────────────────────────────────────────────────
export const createWhiteboard = async (req, res) => {
  try {
    const { title, is_public } = req.body;
    const wb = await Whiteboard.create({
      title: title || "Untitled Whiteboard",
      session_code: generateSessionCode(),
      owner_id: req.user.id,
      collaborators: [req.user.id],
      is_public: is_public !== undefined ? is_public : true,
    });
    const populated = await Whiteboard.findById(wb._id)
      .populate("owner_id", "name email profile_picture")
      .populate("collaborators", "name email profile_picture");
    res.status(201).json(populated);
  } catch (error) {
    console.error("Create whiteboard error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── List ────────────────────────────────────────────────────
export const getMyWhiteboards = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = "active" } = req.query;
    const whiteboards = await Whiteboard.find({
      status,
      $or: [{ owner_id: userId }, { collaborators: userId }, { is_public: true }],
    })
      .populate("owner_id", "name email profile_picture")
      .populate("last_edited_by", "name email profile_picture")
      .sort({ updatedAt: -1 })
      .select("-elements -canvas_state");
    res.json(whiteboards);
  } catch (error) {
    console.error("Get whiteboards error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Get by ID ───────────────────────────────────────────────
export const getWhiteboardById = async (req, res) => {
  try {
    const wb = await Whiteboard.findById(req.params.id)
      .populate("owner_id", "name email profile_picture")
      .populate("collaborators", "name email profile_picture");
    if (!wb) return res.status(404).json({ error: "Whiteboard not found" });
    res.json(wb);
  } catch (error) {
    console.error("Get whiteboard error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Join by code ────────────────────────────────────────────
export const joinByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    const wb = await Whiteboard.findOne({ session_code: code.toUpperCase() });
    if (!wb) return res.status(404).json({ error: "Whiteboard not found" });
    if (wb.status === "archived") return res.status(410).json({ error: "Whiteboard is archived" });
    if (!wb.collaborators.map(String).includes(String(userId))) {
      wb.collaborators.push(userId);
      await wb.save();
    }
    const populated = await Whiteboard.findById(wb._id)
      .populate("owner_id", "name email profile_picture")
      .populate("collaborators", "name email profile_picture");
    res.json(populated);
  } catch (error) {
    console.error("Join whiteboard error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Update metadata ────────────────────────────────────────
export const updateWhiteboard = async (req, res) => {
  try {
    const { title, is_public } = req.body;
    const wb = await Whiteboard.findById(req.params.id);
    if (!wb) return res.status(404).json({ error: "Whiteboard not found" });
    if (title !== undefined) wb.title = title;
    if (is_public !== undefined) wb.is_public = is_public;
    wb.last_edited_by = req.user.id;
    await wb.save();
    res.json(wb);
  } catch (error) {
    console.error("Update whiteboard error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Save content ───────────────────────────────────────────
export const saveContent = async (req, res) => {
  try {
    const { elements, canvas_state } = req.body;
    const wb = await Whiteboard.findById(req.params.id);
    if (!wb) return res.status(404).json({ error: "Whiteboard not found" });
    if (elements !== undefined) wb.elements = elements;
    if (canvas_state !== undefined) wb.canvas_state = canvas_state;
    wb.last_edited_by = req.user.id;
    await wb.save();
    res.json({ success: true, updatedAt: wb.updatedAt });
  } catch (error) {
    console.error("Save content error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Archive ────────────────────────────────────────────────
export const archiveWhiteboard = async (req, res) => {
  try {
    const wb = await Whiteboard.findById(req.params.id);
    if (!wb) return res.status(404).json({ error: "Whiteboard not found" });
    if (String(wb.owner_id) !== String(req.user.id))
      return res.status(403).json({ error: "Only the owner can archive" });
    wb.status = "archived";
    await wb.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Archive whiteboard error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Delete ─────────────────────────────────────────────────
export const deleteWhiteboard = async (req, res) => {
  try {
    const wb = await Whiteboard.findById(req.params.id);
    if (!wb) return res.status(404).json({ error: "Whiteboard not found" });
    if (String(wb.owner_id) !== String(req.user.id))
      return res.status(403).json({ error: "Only the owner can delete" });
    await Whiteboard.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete whiteboard error:", error);
    res.status(500).json({ error: error.message });
  }
};
