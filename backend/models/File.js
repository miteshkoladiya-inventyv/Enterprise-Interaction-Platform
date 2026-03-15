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
  department: {
    type: String,
    default: null
  },
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
  country: {
    type: String,
    enum: ['germany', 'india', 'usa'],
    required: true,
    index: true
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
fileSchema.index({ 'permissions.department': 1 });
fileSchema.index({ 'secure_links.token': 1 });
fileSchema.index({ 'favorites.user_id': 1 });
fileSchema.index({ uploaded_by: 1, created_at: -1 });
fileSchema.index({ country: 1, created_at: -1 });

// Instance methods
fileSchema.methods.hasAccess = function(userId, userDepartment) {
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

  // Check department permissions
  if (this.permissions.department && this.permissions.department === userDepartment) {
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

fileSchema.methods.getPermissionRole = function(userId, userDepartment = null) {
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

  if (this.permissions.department && userDepartment && this.permissions.department === userDepartment) {
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
fileSchema.statics.findAccessibleFiles = function(userId, userDepartment) {
  const accessQuery = [
    { 'permissions.is_public': true },
    { uploaded_by: userId },
    { 'permissions.user_ids': userId },
    { 'permissions.shared_with.user_id': userId }
  ];

  if (userDepartment) {
    accessQuery.push({ 'permissions.department': userDepartment });
  }

  return this.find({ $or: accessQuery }).sort({ created_at: -1 });
};

fileSchema.statics.findByDepartment = function(department) {
  return this.find({
    'permissions.department': department
  }).sort({ created_at: -1 });
};

const File = model("File", fileSchema);
export default File;