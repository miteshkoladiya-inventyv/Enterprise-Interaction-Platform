import { ChatChannel } from "../../models/ChatChannel.js";
import { ChannelMember } from "../../models/ChannelMember.js";
import { Message } from "../../models/Message.js";
import User from "../../models/User.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { getReceiverSocketId, io } from "../../socket/socketServer.js";
import mongoose from "mongoose";

// Create a new chat channel
export const createChannel = async (req, res) => {
  try {
    const {
      channel_type,
      name,
      country_restriction,
      ticket_id,
      department,
      member_ids,
    } = req.body;
    const userId = req.userId;

    // Validate channel type
    if (!["direct", "group", "support", "team"].includes(channel_type)) {
      return res.status(400).json({ error: "Invalid channel type" });
    }

    // For support channels, validate ticket exists
    if (channel_type === "support" && ticket_id) {
      const ticket = await SupportTicket.findById(ticket_id);
      if (!ticket) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
    }

    // Create channel
    const channel = new ChatChannel({
      channel_type,
      name: name || null,
      country_restriction: country_restriction || null,
      ticket_id: ticket_id || null,
      department: department || null,
      created_by: userId,
    });
    await channel.save();

    // Add creator as admin member
    const creatorMember = new ChannelMember({
      channel_id: channel._id,
      user_id: userId,
      role: "admin",
    });
    await creatorMember.save();

    // Collect all member IDs (including creator)
    const allMemberIds = [userId];

    // Add other members if provided
    if (member_ids?.length) {
      await Promise.all(
        member_ids.map(async (member) => {
          const user = await User.findById(member);
          if (!user) return;
          if (user._id.toString() === userId) return;

          await ChannelMember.create({
            channel_id: channel._id,
            user_id: user._id,
            role: "member",
          });

          allMemberIds.push(user._id.toString());
        })
      );
    }

    const members = await ChannelMember.find({
      channel_id: channel._id,
    }).populate("user_id", "first_name last_name email user_type status");

    // Populate and return channel
    const populatedChannel = await ChatChannel.findById(channel._id)
      .populate("created_by", "first_name last_name email")
      .populate("ticket_id");

    // ✅ Emit socket event to all members

    if (io) {
      console.log("INSEDE IO");
      console.log(allMemberIds);
      const channelData = {
        _id: populatedChannel._id,
        channel_type: populatedChannel.channel_type,
        name: populatedChannel.name,
        department: populatedChannel.department,
        country_restriction: populatedChannel.country_restriction,
        member_count: members.length,
        created_by: populatedChannel.created_by,
        created_at: populatedChannel.created_at,
        members: members.map((m) => ({
          user_id: m.user_id._id,
          role: m.role,
          full_name: `${m.user_id.first_name} ${m.user_id.last_name}`,
        })),
      };

      // Emit to all members

      allMemberIds.forEach((user_id) => {
        const receiverSocketId = getReceiverSocketId(user_id.toString());
        console.log({ receiverSocketId, user_id });
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("group_created", channelData);
        }
      });
    }

    res.status(201).json({
      message: "Channel created successfully",
      channel: populatedChannel,
      members,
    });
  } catch (error) {
    console.error("Create channel error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all channels for current user
export const getUserChannels = async (req, res) => {
  try {
    const userId = req.userId;
    const { channel_type, country } = req.query;

    // Find memberships
    const memberships = await ChannelMember.find({ user_id: userId });
    const channelIds = memberships.map((m) => m.channel_id);

    const filter = { _id: { $in: channelIds } };
    if (channel_type) filter.channel_type = channel_type;
    if (country) filter.country_restriction = country;

    const channels = await ChatChannel.find(filter)
      .populate("created_by", "first_name last_name email")
      .populate("ticket_id")
      .sort({ created_at: -1 });

    const channelsWithExtras = await Promise.all(
      channels.map(async (channel) => {
        const lastMessage = await Message.findOne({ channel_id: channel._id })
          .sort({ created_at: -1 })
          .populate("sender_id", "first_name last_name");

        const members = await ChannelMember.find({
          channel_id: channel._id,
        }).populate("user_id", "first_name last_name email user_type status");

        const myMembership = members.find(
          (m) =>
            m.user_id &&
            m.user_id._id &&
            m.user_id._id.toString() === userId.toString()
        );
        const user_role = myMembership ? myMembership.role : null;

        return {
          ...channel.toObject(),
          last_message: lastMessage,
          member_count: members.length,
          members,
          user_role,
        };
      })
    );

    // Sort channels by last message timestamp (most recent first)
    channelsWithExtras.sort((a, b) => {
      const aTime = a.last_message?.created_at
        ? new Date(a.last_message.created_at).getTime()
        : new Date(a.created_at).getTime();
      const bTime = b.last_message?.created_at
        ? new Date(b.last_message.created_at).getTime()
        : new Date(b.created_at).getTime();

      return bTime - aTime; // Descending order (most recent first)
    });

    res.json({
      count: channelsWithExtras.length,
      channels: channelsWithExtras,
    });
  } catch (error) {
    console.error("Get user channels error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get channel by ID
export const getChannelById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      channel_id: id,
      user_id: userId,
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    const channel = await ChatChannel.findById(id)
      .populate("created_by", "first_name last_name email")
      .populate("ticket_id");

    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Get all members
    const members = await ChannelMember.find({ channel_id: id })
      .populate("user_id", "first_name last_name email user_type status")
      .sort({ joined_at: 1 });

    res.json({
      channel,
      members,
      user_role: membership.role,
    });
  } catch (error) {
    console.error("Get channel by ID error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Add members to channel
export const addChannelMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { member_ids } = req.body;
    const userId = req.userId;

    if (!member_ids || !Array.isArray(member_ids)) {
      return res.status(400).json({ error: "member_ids array is required" });
    }

    // Check if user is admin of channel
    const membership = await ChannelMember.findOne({
      channel_id: id,
      user_id: userId,
    });

    if (!membership || membership.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only channel admins can add members" });
    }

    const addedMembers = [];
    const errors = [];

    for (const memberId of member_ids) {
      try {
        // Check if user exists
        const userExists = await User.findById(memberId);
        if (!userExists) {
          errors.push({ user_id: memberId, error: "User not found" });
          continue;
        }

        // Check if already a member
        const existingMember = await ChannelMember.findOne({
          channel_id: id,
          user_id: memberId,
        });

        if (existingMember) {
          errors.push({ user_id: memberId, error: "Already a member" });
          continue;
        }

        // Add member
        const newMember = new ChannelMember({
          channel_id: id,
          user_id: memberId,
          role: "member",
        });
        await newMember.save();

        const populated = await ChannelMember.findById(newMember._id).populate(
          "user_id",
          "first_name last_name email"
        );

        addedMembers.push(populated);
      } catch (err) {
        errors.push({ user_id: memberId, error: err.message });
      }
    }

    // Notify all channel members (existing + newly added) so everyone's UI updates to match DB
    if (addedMembers.length > 0) {
      const allMembers = await ChannelMember.find({ channel_id: id }).select(
        "user_id"
      );
      allMembers.forEach((member) => {
        const socketId = getReceiverSocketId(member.user_id.toString());
        if (socketId) {
          io.to(socketId).emit("memberAdded", {
            channelId: id,
          });
        }
      });
    }

    res.json({
      message: "Members processed",
      added_members: addedMembers,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Add channel members error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Remove member from channel
export const removeChannelMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.userId;

    // Check if user is admin of channel
    const membership = await ChannelMember.findOne({
      channel_id: id,
      user_id: userId,
    });

    if (!membership || membership.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only channel admins can remove members" });
    }

    // Cannot remove yourself if you're the only admin
    if (userId === memberId) {
      const adminCount = await ChannelMember.countDocuments({
        channel_id: id,
        role: "admin",
      });

      if (adminCount === 1) {
        return res.status(400).json({
          error:
            "Cannot remove yourself as the only admin. Assign another admin first.",
        });
      }
    }

    const removed = await ChannelMember.findOneAndDelete({
      channel_id: id,
      user_id: memberId,
    });

    if (!removed) {
      return res.status(404).json({ error: "Member not found in channel" });
    }

    // Notify all remaining channel members so their UI (e.g. settings modal) updates
    const remainingMembers = await ChannelMember.find({
      channel_id: id,
    }).select("user_id");
    const removedUserIdStr = memberId?.toString?.() ?? memberId;
    remainingMembers.forEach((member) => {
      const socketId = getReceiverSocketId(member.user_id.toString());
      if (socketId) {
        io.to(socketId).emit("memberRemoved", {
          channelId: id,
          removedUserId: removedUserIdStr,
        });
      }
    });

    // Notify the removed user so they see "You are removed from this group" until refresh
    const removedUserSocketId = getReceiverSocketId(removedUserIdStr);
    if (removedUserSocketId) {
      io.to(removedUserSocketId).emit("youWereRemovedFromChannel", {
        channelId: id,
      });
    }

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Remove channel member error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update member role
export const updateMemberRole = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;
    const userId = req.userId;

    if (!["admin", "moderator", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Check if user is admin of channel
    const membership = await ChannelMember.findOne({
      channel_id: id,
      user_id: userId,
    });

    if (!membership || membership.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only channel admins can update member roles" });
    }

    const updatedMember = await ChannelMember.findOneAndUpdate(
      { channel_id: id, user_id: memberId },
      { role },
      { new: true }
    ).populate("user_id", "first_name last_name email");

    if (!updatedMember) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Get all members of the channel
    const channelMembers = await ChannelMember.find({ channel_id: id });

    // Emit role change to all channel members
    channelMembers.forEach((member) => {
      const memberSocketId = getReceiverSocketId(member.user_id.toString());
      if (memberSocketId) {
        io.to(memberSocketId).emit("changesRole", {
          channelId: id,
          member: updatedMember,
        });
      }
    });

    res.json({
      message: "Member role updated successfully",
      member: updatedMember,
    });
  } catch (error) {
    console.error("Update member role error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Leave channel
export const leaveChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if user is member
    const membership = await ChannelMember.findOne({
      channel_id: id,
      user_id: userId,
    });

    if (!membership) {
      return res
        .status(404)
        .json({ error: "You are not a member of this channel" });
    }

    // Check if user is the only admin
    if (membership.role === "admin") {
      const adminCount = await ChannelMember.countDocuments({
        channel_id: id,
        role: "admin",
      });

      if (adminCount === 1) {
        return res.status(400).json({
          error:
            "Cannot leave channel as the only admin. Assign another admin first or delete the channel.",
        });
      }
    }

    await ChannelMember.findByIdAndDelete(membership._id);

    const receiverSocketId = getReceiverSocketId(userId);

    io.to(receiverSocketId).emit("leavechannel", id);

    res.json({ message: "Left channel successfully" });
  } catch (error) {
    console.error("Leave channel error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete channel
export const deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if user is admin of channel
    const membership = await ChannelMember.findOne({
      channel_id: id,
      user_id: userId,
    });

    if (!membership || membership.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only channel admins can delete the channel" });
    }

    // Delete all messages in channel
    await Message.deleteMany({ channel_id: id });

    // Delete all channel members
    await ChannelMember.deleteMany({ channel_id: id });

    // Delete channel
    await ChatChannel.findByIdAndDelete(id);

    res.json({ message: "Channel deleted successfully" });
  } catch (error) {
    console.error("Delete channel error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Controller to update channel name
export const updateChannelName = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { name } = req.body;
    const userId = req.userId;

    // 1️⃣ Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Channel name is required",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        error: "Channel name must be less than 100 characters",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid channel ID",
      });
    }

    // 2️⃣ Check channel exists
    const channel = await ChatChannel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: "Channel not found",
      });
    }

    // 3️⃣ Check membership + admin
    const membership = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You are not a member of this channel",
      });
    }

    if (membership.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Only admins can update the channel name",
      });
    }

    // 4️⃣ Get ALL members of the channel
    const channelMembers = await ChannelMember.find({
      channel_id: channelId,
    }).populate("user_id", "_id");

    // 5️⃣ Update channel name
    const oldName = channel.name;
    channel.name = name.trim();
    await channel.save();

    // 6️⃣ Notify ALL channel members via socket
    console.log({ channelMembers });
    channelMembers.forEach((member) => {
      const memberId = member.user_id._id.toString();
      const socketIds = getReceiverSocketId(memberId);
      // console.log({ memberId, socketIds });
      if (!socketIds) return;
      io.to(socketIds).emit("channel_name_changed", {
        channel_id: channel._id,
        name: channel.name,
        old_name: oldName,
      });
      // support single or multiple sockets
      // const ids = Array.isArray(socketIds) ? socketIds : [socketIds];
      // console.log(ids);
      // ids.forEach((sid) => {
      //   io.to(sid).emit("channel_name_changed", {
      //     channel_id: channel._id,
      //     name: channel.name,
      //     old_name: oldName,
      //   });
      // });
    });

    return res.status(200).json({
      success: true,
      message: "Channel name updated successfully",
      data: {
        channel_id: channel._id,
        name: channel.name,
        old_name: oldName,
      },
    });
  } catch (error) {
    console.error("Error updating channel name:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update channel name",
      details: error.message,
    });
  }
};

export const searchMessagesInChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { query } = req.query;
    const userId = req.user.id;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Find the channel and verify it exists
    const channel = await ChatChannel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Check if user is a member of this channel
    const membershipExists = await ChannelMember.findOne({
      channel_id: channelId,
      user_id: userId,
    });

    if (!membershipExists) {
      return res
        .status(403)
        .json({ error: "You are not a member of this channel" });
    }

    // Search messages using case-insensitive regex
    const searchRegex = new RegExp(query.trim(), "i");

    const messages = await Message.find({
      channel_id: channelId,
      content: searchRegex,
      deleted_at: null, // Exclude deleted messages
    })
      .populate("sender_id", "first_name last_name full_name email user_type")
      .populate("seen_by.user_id", "first_name last_name full_name email")
      .populate("parent_message_id", "content sender_id") // Populate parent message if exists
      .sort({ created_at: -1 }) // Most recent first
      .limit(100) // Limit results to prevent performance issues
      .lean();

    // Add is_own flag and format response
    const messagesWithFlags = messages.map((msg) => ({
      ...msg,
      _id: msg._id.toString(),
      sender: msg.sender_id,
      is_own: msg.sender_id?._id.toString() === userId.toString(),
      seen_count: msg.seen_by ? msg.seen_by.length : 0,
      is_seen: msg.seen_by
        ? msg.seen_by.some(
            (seen) => seen.user_id._id.toString() === userId.toString()
          )
        : false,
    }));

    res.json({
      messages: messagesWithFlags,
      total: messagesWithFlags.length,
      query: query.trim(),
    });
  } catch (error) {
    console.error("Error searching messages:", error);
    res.status(500).json({
      error: "Failed to search messages",
      message: error.message,
    });
  }
};
