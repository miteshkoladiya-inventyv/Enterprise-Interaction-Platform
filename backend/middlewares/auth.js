/**
 * Authentication and authorization middleware
 */
import { ChannelMember } from "../models/ChannelMember.js";
import { sendForbidden, sendNotFound } from "../utils/responseFormatter.js";

/**
 * Middleware to verify user is a member of a channel
 */
export const requireChannelMembership = async (req, res, next) => {
  try {
    const { id, channelId } = req.params;
    const targetChannelId = id || channelId;
    const userId = req.userId;

    if (!targetChannelId) {
      return sendForbidden(res, 'Channel ID is required');
    }

    const membership = await ChannelMember.findOne({
      channel_id: targetChannelId,
      user_id: userId,
    });

    if (!membership) {
      return sendForbidden(res, 'You are not a member of this channel');
    }

    req.membership = membership;
    req.channelId = targetChannelId;
    next();
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] Error:', error.message);
    return sendForbidden(res, 'Authorization failed');
  }
};

/**
 * Middleware to verify user has admin role in a channel
 */
export const requireChannelAdmin = async (req, res, next) => {
  try {
    const { id, channelId } = req.params;
    const targetChannelId = id || channelId;
    const userId = req.userId;

    const membership = await ChannelMember.findOne({
      channel_id: targetChannelId,
      user_id: userId,
    });

    if (!membership || membership.role !== 'admin') {
      return sendForbidden(res, 'Only channel admins can perform this action');
    }

    req.membership = membership;
    req.channelId = targetChannelId;
    next();
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] Error:', error.message);
    return sendForbidden(res, 'Authorization failed');
  }
};

/**
 * Helper function to check meeting access permissions
 * Returns: { isHost, isParticipant, hasAccess }
 */
export const checkMeetingAccess = (meeting, userId) => {
  const normalizedUserId = String(userId);
  const isHost = String(meeting.host_id) === normalizedUserId;
  const isParticipant =
    Array.isArray(meeting.participants) &&
    meeting.participants.some((p) => String(p) === normalizedUserId);

  return {
    isHost,
    isParticipant,
    hasAccess: isHost || isParticipant,
  };
};

/**
 * Helper to verify meeting access and return error if not allowed
 */
export const verifyMeetingAccess = (meeting, userId, res) => {
  const access = checkMeetingAccess(meeting, userId);
  if (!access.hasAccess) {
    sendForbidden(res, 'You are not allowed to access this meeting');
    return null;
  }
  return access;
};
