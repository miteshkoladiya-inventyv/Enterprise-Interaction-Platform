/**
 * Input validation schemas and helpers
 */

export const escapeRegex = (str) => {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const validateChannelId = (id) => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Channel ID is required');
  }
  return id.trim();
};

export const validateUserId = (id) => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('User ID is required');
  }
  return String(id).trim();
};

export const validateMessageContent = (content, maxLength = 10000) => {
  if (!content || typeof content !== 'string') {
    throw new Error('Message content is required');
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Message cannot be empty');
  }
  if (trimmed.length > maxLength) {
    throw new Error(`Message cannot exceed ${maxLength} characters`);
  }
  return trimmed;
};

export const validateChannelName = (name, maxLength = 100) => {
  if (!name || typeof name !== 'string') {
    throw new Error('Channel name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Channel name cannot be empty');
  }
  if (trimmed.length > maxLength) {
    throw new Error(`Channel name cannot exceed ${maxLength} characters`);
  }
  return trimmed;
};

export const validateSearchQuery = (query, maxLength = 200) => {
  if (!query || typeof query !== 'string') {
    throw new Error('Search query is required');
  }
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new Error('Search query cannot be empty');
  }
  if (trimmed.length > maxLength) {
    throw new Error(`Search query cannot exceed ${maxLength} characters`);
  }
  return escapeRegex(trimmed);
};

export const validateLimit = (limit, defaultLimit = 50, maxLimit = 500) => {
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
};

export const validateDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  return date;
};

export const validateMeetingTitle = (title) => {
  if (!title || typeof title !== 'string') {
    throw new Error('Meeting title is required');
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error('Meeting title cannot be empty');
  }
  if (trimmed.length > 500) {
    throw new Error('Meeting title cannot exceed 500 characters');
  }
  return trimmed;
};

export const validateArrayOfIds = (arr) => {
  if (!Array.isArray(arr)) {
    throw new Error('Expected an array');
  }
  return arr.map(id => validateUserId(id));
};
