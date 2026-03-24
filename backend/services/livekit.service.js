import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

function normalizeEnvValue(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  // Support copied values wrapped in single/double quotes.
  return trimmed.replace(/^['"](.*)['"]$/, "$1").trim();
}

function requireLiveKitEnv() {
  const apiKey = normalizeEnvValue(process.env.LIVEKIT_API_KEY);
  const apiSecret = normalizeEnvValue(process.env.LIVEKIT_API_SECRET);
  const wsUrlRaw = normalizeEnvValue(process.env.LIVEKIT_URL);

  if (!apiKey || !apiSecret || !wsUrlRaw) {
    throw new Error(
      "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in backend/.env"
    );
  }

  let wsUrl;
  try {
    wsUrl = new URL(wsUrlRaw);
  } catch {
    throw new Error("LIVEKIT_URL is invalid. Expected a valid wss://<project>.livekit.cloud URL.");
  }

  if (wsUrl.protocol !== "wss:") {
    throw new Error("LIVEKIT_URL must use wss:// for LiveKit Cloud.");
  }

  if (!wsUrl.hostname.endsWith(".livekit.cloud")) {
    throw new Error("LIVEKIT_URL must point to LiveKit Cloud (for example: wss://your-project.livekit.cloud).");
  }

  return { apiKey, apiSecret, wsUrl };
}

export function assertLiveKitCloudConfigured() {
  requireLiveKitEnv();
}

export function getLiveKitCloudDiagnostics() {
  const { apiKey, wsUrl } = requireLiveKitEnv();
  return {
    configured: true,
    url: wsUrl.toString(),
    host: wsUrl.hostname,
    protocol: wsUrl.protocol,
    apiKeyPreview: `${apiKey.slice(0, 4)}...${apiKey.slice(-2)}`,
    cloud: wsUrl.hostname.endsWith(".livekit.cloud"),
  };
}

export async function createLiveKitToken({
  identity,
  name,
  roomName,
  metadata = {},
  canPublish = true,
  canSubscribe = true,
  canPublishData = true,
}) {
  const { apiKey, apiSecret, wsUrl } = requireLiveKitEnv();

  const token = new AccessToken(apiKey, apiSecret, {
    identity: String(identity),
    name: name || String(identity),
    metadata: JSON.stringify(metadata || {}),
    ttl: "2h",
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe,
    canPublishData,
  });

  return {
    token: await token.toJwt(),
    url: wsUrl.toString(),
  };
}

export async function validateLiveKitCloudCredentials() {
  const { apiKey, apiSecret, wsUrl } = requireLiveKitEnv();
  const client = new RoomServiceClient(wsUrl.toString(), apiKey, apiSecret);
  await client.listRooms();
  return true;
}
