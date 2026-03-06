import OpenAI from "openai";
import { Message } from "../../models/Message.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import { ChatChannel } from "../../models/ChatChannel.js";

// Groq client — OpenAI-compatible API
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
const GROQ_MODEL = "llama-3.3-70b-versatile";

export const chatSummary = async (req, res) => {
  try {
    const userId = req.userId;
    const { channel_id } = req.params;

    // Verify the user is a member of the channel
    const membership = await ChannelMember.findOne({
      channel_id,
      user_id: userId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Verify channel exists
    const channel = await ChatChannel.findById(channel_id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Fetch all messages in the channel that the user has NOT seen
    // A message is "unseen" if userId is not present in the seen_by array
    // and the message was not sent by the user themselves
    const unseenMessages = await Message.find({
      channel_id,
      sender_id: { $ne: userId },
      deleted_at: null,
      "seen_by.user_id": { $nin: [userId] },
    })
      .sort({ created_at: 1 })
      .populate("sender_id", "first_name last_name email")
      .lean();

    if (unseenMessages.length === 0) {
      return res.status(200).json({
        summary: null,
        message: "No unseen messages found in this channel.",
        unseen_count: 0,
      });
    }

    // Build a readable transcript for the LLM
    const transcript = unseenMessages
      .map((msg) => {
        const senderName = msg.sender_id
          ? `${msg.sender_id.first_name ?? ""} ${msg.sender_id.last_name ?? ""}`.trim()
          : "Unknown User";

        const timestamp = new Date(msg.created_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        if (msg.message_type === "file") {
          return `[${timestamp}] ${senderName}: [Shared a file: ${msg.file_name ?? "file"}]`;
        }

        if (msg.message_type === "system") {
          return `[${timestamp}] System: ${msg.content}`;
        }

        return `[${timestamp}] ${senderName}: ${msg.content}`;
      })
      .join("\n");

    // Prompt the LLM to generate a concise summary
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that summarizes chat conversations. 
Given a transcript of messages a user has not yet read, provide a concise and clear summary that:
- Highlights the key topics discussed
- Mentions any important decisions, action items, or requests directed at the user (if any)
- Notes any files or resources shared
- Keeps the summary brief (3–6 sentences max)
- Uses a neutral, professional tone`,
        },
        {
          role: "user",
          content: `Please summarize the following unseen messages from a chat channel:\n\n${transcript}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.4,
    });

    const summary = completion.choices[0]?.message?.content?.trim();

    return res.status(200).json({
      summary,
      unseen_count: unseenMessages.length,
      channel: {
        id: channel._id,
        name: channel.name ?? null,
        channel_type: channel.channel_type,
      },
    });
  } catch (error) {
    console.error("Chat summary error:", error);
    res.status(500).json({ error: error.message });
  }
};