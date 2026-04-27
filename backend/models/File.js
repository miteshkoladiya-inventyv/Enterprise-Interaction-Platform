// models/File.js
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const uploaderInfoSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  }
}, { _id: false });

const fileShareMemberSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['viewer', 'editor'],
    default: 'viewer'
  },
  added_at: {
    type: Date,
    default: Date.now
  },
  added_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { _id: false });

const filePermissionsSchema = new Schema({
  user_ids: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  shared_with: [fileShareMemberSchema],
  is_public: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const fileVersionSchema = new Schema({
  version_number: {
    type: Number,
    required: true
  },
  storage_path: {
    type: String,
    required: true
  },
  storage_url: {
    type: String,
    default: null
  },
  uploaded_at: {
    type: Date,
    default: Date.now
  },
  uploaded_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  file_size: {
    type: Number,
    required: true
  }
}, { _id: false });

const activityLogSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['view', 'download', 'edit', 'delete', 'share', 'favorite', 'pin', 'summary'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ip_address: {
    type: String,
    default: null
  }
}, { _id: false });

const favoriteEntrySchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  added_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const fileCommentSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

const fileMetadataSchema = new Schema({
  description: {
    type: String,
    default: ''
  },
  tags: [{
    type: String
  }],
  category: {
    type: String,
    default: null
  }
}, { _id: false });

const secureLinkSchema = new Schema({
  token: {
    type: String,
    required: true
  },
  expires_at: {
    type: Date,
    required: true
  },
  one_time: {
    type: Boolean,
    default: false
  },
  used_at: {
    type: Date,
    default: null
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  password_hash: {
    type: String,
    default: null
  }
}, { _id: false });

const fileSchema = new Schema({
  file_name: {
    type: String,
    required: true,
    trim: true
  },
  file_type: {
    type: String,
    required: true
    // MIME type: image/png, application/pdf, etc.
  },
  file_size: {
    type: Number,
    required: true
    // in bytes
  },
  storage_path: {
    type: String,
    required: true
    // S3/MinIO path
  },
  storage_url: {
    type: String,
    required: true
  },
  uploaded_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  uploader_info: {
    type: uploaderInfoSchema,
    required: true
  },
  permissions: {
    type: filePermissionsSchema,
    required: true
  },
  versions: [fileVersionSchema],
  metadata: {
    type: fileMetadataSchema,
    default: () => ({})
  },
  secure_links: [secureLinkSchema],
  favorites: [favoriteEntrySchema],
  comments: [fileCommentSchema],
  // Trash / Soft delete fields
  is_deleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deleted_at: {
    type: Date,
    default: null
  },
  deleted_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  activity_log: [activityLogSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
fileSchema.index({ 'permissions.user_ids': 1 });
fileSchema.index({ 'permissions.shared_with.user_id': 1 });
fileSchema.index({ 'secure_links.token': 1 });
fileSchema.index({ 'favorites.user_id': 1 });
fileSchema.index({ uploaded_by: 1, created_at: -1 });
fileSchema.index({ is_deleted: 1, deleted_at: 1 });

// Instance methods
fileSchema.methods.hasAccess = function(userId) {
  // Public files
  if (this.permissions.is_public) {
    return true;
  }

  // Uploader always has access
  if (this.uploaded_by.toString() === userId.toString()) {
    return true;
  }

  // Backward-compatible direct user permissions
  if ((this.permissions.user_ids || []).some(id => id.toString() === userId.toString())) {
    return true;
  }

  // Role-based shares
  if ((this.permissions.shared_with || []).some(entry => entry.user_id?.toString() === userId.toString())) {
    return true;
  }

  return false;
};

fileSchema.methods.logActivity = function(userId, action, ipAddress = null) {
  this.activity_log.push({
    user_id: userId,
    action: action,
    ip_address: ipAddress
  });
};

fileSchema.methods.getPermissionRole = function(userId) {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId) return null;

  if (this.uploaded_by.toString() === normalizedUserId) {
    return 'owner';
  }

  const sharedRole = (this.permissions.shared_with || []).find(
    entry => entry.user_id?.toString() === normalizedUserId
  );
  if (sharedRole?.role) {
    return sharedRole.role;
  }

  if ((this.permissions.user_ids || []).some(id => id.toString() === normalizedUserId)) {
    return 'viewer';
  }

  if (this.permissions.is_public) {
    return 'viewer';
  }

  return null;
};

fileSchema.methods.addVersion = function(storagePath, uploadedBy, fileSize, storageUrl = null) {
  const versionNumber = this.versions.length + 1;
  
  this.versions.push({
    version_number: versionNumber,
    storage_path: storagePath,
    storage_url: storageUrl,
    uploaded_by: uploadedBy,
    file_size: fileSize
  });
  
  // Update current storage path and size
  this.storage_path = storagePath;
  this.file_size = fileSize;
  
  return versionNumber;
};

fileSchema.methods.grantAccess = function(userId, role = 'viewer', addedBy = null) {
  const normalizedUserId = userId.toString();

  if (!(this.permissions.user_ids || []).some(id => id.toString() === normalizedUserId)) {
    this.permissions.user_ids.push(userId);
  }

  const existing = (this.permissions.shared_with || []).find(
    entry => entry.user_id?.toString() === normalizedUserId
  );

  if (existing) {
    existing.role = role;
    if (addedBy) existing.added_by = addedBy;
  } else {
    this.permissions.shared_with.push({
      user_id: userId,
      role,
      added_by: addedBy
    });
  }
};

fileSchema.methods.revokeAccess = function(userId) {
  const normalizedUserId = userId.toString();
  this.permissions.user_ids = (this.permissions.user_ids || []).filter(
    id => id.toString() !== normalizedUserId
  );

  this.permissions.shared_with = (this.permissions.shared_with || []).filter(
    entry => entry.user_id?.toString() !== normalizedUserId
  );
};

fileSchema.methods.isFavoritedBy = function(userId) {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId) return false;
  return (this.favorites || []).some((entry) => entry.user_id?.toString() === normalizedUserId);
};

fileSchema.methods.setFavoriteForUser = function(userId, enabled) {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId) return false;

  const favorites = this.favorites || [];
  const exists = favorites.some((entry) => entry.user_id?.toString() === normalizedUserId);

  if (enabled && !exists) {
    favorites.push({ user_id: userId, added_at: new Date() });
  }

  if (!enabled && exists) {
    this.favorites = favorites.filter((entry) => entry.user_id?.toString() !== normalizedUserId);
  } else {
    this.favorites = favorites;
  }

  return enabled;
};



// Static methods
fileSchema.statics.findAccessibleFiles = function(userId, includeDeleted = false) {
  const accessQuery = [
    { 'permissions.is_public': true },
    { uploaded_by: userId },
    { 'permissions.user_ids': userId },
    { 'permissions.shared_with.user_id': userId }
  ];

  const baseQuery = { $or: accessQuery };
  
  // By default, exclude deleted files
  if (!includeDeleted) {
    baseQuery.is_deleted = { $ne: true };
  }

  return this.find(baseQuery).sort({ created_at: -1 });
};

// Find files in trash for a specific user (owner only sees their deleted files)
fileSchema.statics.findTrashFiles = function(userId) {
  return this.find({
    uploaded_by: userId,
    is_deleted: true
  }).sort({ deleted_at: -1 });
};

const File = model("File", fileSchema);
export default File;
