// jobs/fileCleanupJob.js
// Cleans up expired secure links and optionally old file versions from the database
import File from "../models/File.js";

/**
 * Clean up expired secure links from all files
 * This reduces database bloat and improves query performance
 */
const cleanupExpiredSecureLinks = async () => {
  try {
    const now = new Date();
    
    // Find files with expired secure links
    const filesWithExpiredLinks = await File.find({
      "secure_links.expires_at": { $lt: now }
    });

    let totalCleaned = 0;

    for (const file of filesWithExpiredLinks) {
      const originalCount = file.secure_links?.length || 0;
      
      // Filter out expired links
      file.secure_links = (file.secure_links || []).filter(link => {
        const expiresAt = new Date(link.expires_at);
        return expiresAt > now;
      });

      const removed = originalCount - file.secure_links.length;
      if (removed > 0) {
        await file.save();
        totalCleaned += removed;
      }
    }

    if (totalCleaned > 0) {
      console.log(`[FileCleanup] Removed ${totalCleaned} expired secure links from ${filesWithExpiredLinks.length} files`);
    }

    return { cleanedLinks: totalCleaned, filesProcessed: filesWithExpiredLinks.length };
  } catch (error) {
    console.error("[FileCleanup] Error cleaning expired secure links:", error);
    throw error;
  }
};

/**
 * Clean up old activity logs (optional - keep last N entries per file)
 * @param {number} maxLogsPerFile - Maximum activity log entries to keep per file
 */
const cleanupOldActivityLogs = async (maxLogsPerFile = 500) => {
  try {
    const filesWithManyLogs = await File.find({
      $expr: { $gt: [{ $size: "$activity_log" }, maxLogsPerFile] }
    });

    let totalTrimmed = 0;

    for (const file of filesWithManyLogs) {
      const originalCount = file.activity_log?.length || 0;
      
      // Sort by timestamp descending and keep only the most recent entries
      file.activity_log = (file.activity_log || [])
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, maxLogsPerFile);

      const removed = originalCount - file.activity_log.length;
      if (removed > 0) {
        await file.save();
        totalTrimmed += removed;
      }
    }

    if (totalTrimmed > 0) {
      console.log(`[FileCleanup] Trimmed ${totalTrimmed} old activity log entries from ${filesWithManyLogs.length} files`);
    }

    return { trimmedLogs: totalTrimmed, filesProcessed: filesWithManyLogs.length };
  } catch (error) {
    console.error("[FileCleanup] Error cleaning old activity logs:", error);
    throw error;
  }
};

/**
 * Clean up old file versions (keep only the most recent N versions per file)
 * Note: This only removes version metadata from MongoDB, not the actual files from Cloudinary
 * To also delete from Cloudinary, set deleteFromStorage = true (use with caution)
 * @param {number} maxVersionsPerFile - Maximum versions to keep per file (default: 10)
 */
const cleanupOldVersions = async (maxVersionsPerFile = 10) => {
  try {
    const filesWithManyVersions = await File.find({
      $expr: { $gt: [{ $size: "$versions" }, maxVersionsPerFile] }
    });

    let totalTrimmed = 0;

    for (const file of filesWithManyVersions) {
      const originalCount = file.versions?.length || 0;
      
      // Sort by version_number descending and keep only the most recent versions
      file.versions = (file.versions || [])
        .sort((a, b) => b.version_number - a.version_number)
        .slice(0, maxVersionsPerFile);

      const removed = originalCount - file.versions.length;
      if (removed > 0) {
        await file.save();
        totalTrimmed += removed;
      }
    }

    if (totalTrimmed > 0) {
      console.log(`[FileCleanup] Trimmed ${totalTrimmed} old versions from ${filesWithManyVersions.length} files`);
    }

    return { trimmedVersions: totalTrimmed, filesProcessed: filesWithManyVersions.length };
  } catch (error) {
    console.error("[FileCleanup] Error cleaning old versions:", error);
    throw error;
  }
};

/**
 * Main cleanup job - runs all cleanup tasks
 */
const runFileCleanup = async () => {
  console.log("[FileCleanup] Starting file cleanup job...");
  
  const results = {
    secureLinks: await cleanupExpiredSecureLinks(),
    activityLogs: await cleanupOldActivityLogs(500),
    versions: await cleanupOldVersions(10),
  };

  console.log("[FileCleanup] Cleanup complete:", results);
  return results;
};

/**
 * Schedule the cleanup job to run periodically
 * @param {number} intervalHours - How often to run (default: 24 hours)
 */
export const scheduleFileCleanup = (intervalHours = 24) => {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  // Run immediately on startup
  runFileCleanup().catch(err => console.error("[FileCleanup] Initial run failed:", err));
  
  // Schedule recurring runs
  setInterval(() => {
    runFileCleanup().catch(err => console.error("[FileCleanup] Scheduled run failed:", err));
  }, intervalMs);

  console.log(`[FileCleanup] Job scheduled to run every ${intervalHours} hours`);
};

export { runFileCleanup, cleanupExpiredSecureLinks, cleanupOldActivityLogs, cleanupOldVersions };
