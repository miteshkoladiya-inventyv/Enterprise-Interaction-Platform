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

const filePermissionsSchema = new Schema({
  user_ids: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
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
    enum: ['view', 'download', 'edit', 'delete', 'share'],
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
fileSchema.index({ 'permissions.department': 1 });
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
  
  // Check specific user permissions
  if (this.permissions.user_ids.some(id => id.toString() === userId.toString())) {
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

fileSchema.methods.addVersion = function(storagePath, uploadedBy, fileSize) {
  const versionNumber = this.versions.length + 1;
  
  this.versions.push({
    version_number: versionNumber,
    storage_path: storagePath,
    uploaded_by: uploadedBy,
    file_size: fileSize
  });
  
  // Update current storage path and size
  this.storage_path = storagePath;
  this.file_size = fileSize;
  
  return versionNumber;
};

fileSchema.methods.grantAccess = function(userId) {
  if (!this.permissions.user_ids.some(id => id.toString() === userId.toString())) {
    this.permissions.user_ids.push(userId);
  }
};

fileSchema.methods.revokeAccess = function(userId) {
  this.permissions.user_ids = this.permissions.user_ids.filter(
    id => id.toString() !== userId.toString()
  );
};

// Static methods
fileSchema.statics.findAccessibleFiles = function(userId, userDepartment) {
  return this.find({
    $or: [
      { 'permissions.is_public': true },
      { uploaded_by: userId },
      { 'permissions.user_ids': userId },
      { 'permissions.department': userDepartment }
    ]
  }).sort({ created_at: -1 });
};

fileSchema.statics.findByDepartment = function(department) {
  return this.find({
    'permissions.department': department
  }).sort({ created_at: -1 });
};

const File = model("File", fileSchema);
export default File;