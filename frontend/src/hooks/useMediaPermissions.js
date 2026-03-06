/**
 * Utility to request microphone (and optionally camera) permissions
 * before starting any WebRTC call flow.
 *
 * Some browsers (Safari, Firefox, mobile) won't show the permission
 * prompt unless it originates from a direct user gesture and the page
 * is served over HTTPS. This helper:
 *  1. Checks the current permission state via the Permissions API (where supported).
 *  2. If not yet granted, calls getUserMedia to trigger the browser prompt.
 *  3. Returns the MediaStream on success, or throws a descriptive error.
 */

/**
 * @param {{ audio?: boolean, video?: boolean }} constraints
 * @returns {Promise<MediaStream>}
 */
export async function requestMediaPermissions(constraints = { audio: true }) {
  // 1. Quick check via Permissions API (not supported in all browsers)
  if (navigator.permissions && navigator.permissions.query) {
    try {
      if (constraints.audio) {
        const micStatus = await navigator.permissions.query({ name: "microphone" });
        if (micStatus.state === "denied") {
          throw new PermissionDeniedError(
            "Microphone access is blocked. Please allow microphone access in your browser settings and try again."
          );
        }
      }
      if (constraints.video) {
        const camStatus = await navigator.permissions.query({ name: "camera" });
        if (camStatus.state === "denied") {
          throw new PermissionDeniedError(
            "Camera access is blocked. Please allow camera access in your browser settings and try again."
          );
        }
      }
    } catch (err) {
      // Permissions API may not support "microphone"/"camera" queries in some
      // browsers (e.g. Firefox). Fall through to getUserMedia which will prompt.
      if (err instanceof PermissionDeniedError) throw err;
    }
  }

  // 2. Request the stream — this triggers the browser permission prompt
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err) {
    const needsVideo = constraints.video;
    const needsAudio = constraints.audio;
    const deviceType = needsVideo && needsAudio ? "camera and microphone" : needsVideo ? "camera" : "microphone";
    
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      throw new PermissionDeniedError(
        `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} access was denied. Please allow ${deviceType} permission in your browser and try again.`
      );
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      throw new PermissionDeniedError(
        `No ${deviceType} found. Please connect a ${deviceType} and try again.`
      );
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      throw new PermissionDeniedError(
        `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} is already in use by another application. Please close it and try again.`
      );
    }
    if (err.name === "OverconstrainedError") {
      throw new PermissionDeniedError(
        `Could not find a suitable ${deviceType} with the requested settings.`
      );
    }
    // SecurityError usually means non-HTTPS
    if (err.name === "SecurityError") {
      throw new PermissionDeniedError(
        "Media access requires a secure connection (HTTPS). Please use HTTPS and try again."
      );
    }
    throw new PermissionDeniedError(
      `Could not access ${deviceType}: ${err.message || "Unknown error"}`
    );
  }
}

/**
 * Custom error class so callers can distinguish permission issues
 * from other errors.
 */
export class PermissionDeniedError extends Error {
  constructor(message) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}
