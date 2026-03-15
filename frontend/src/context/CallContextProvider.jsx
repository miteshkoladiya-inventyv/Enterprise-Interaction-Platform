import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuthContext } from "./AuthContextProvider";
import { useAudioCall } from "../hooks/useAudioCall";
import { useVideoCall } from "../hooks/useVideoCall";
import IncomingCallModal from "../components/IncomingCallModal";
import IncomingVideoCallModal from "../components/IncomingVideoCallModal";
import OutgoingCallModal from "../components/OutgoingCallModal";
import OutgoingVideoCallModal from "../components/OutgoingVideoCallModal";
import ActiveCallBar from "../components/ActiveCallBar";
import ActiveVideoCallBar from "../components/ActiveVideoCallBar";
import { BACKEND_URL } from "@/config";

const CallContext = createContext(null);

/**
 * Global call provider: keeps 1-to-1 audio/video call state and socket listeners
 * mounted regardless of which tab (Messages, Meetings, etc.) is open, so the
 * other person always gets accept/decline when they're on any tab.
 */
export function GlobalCallProvider({ children }) {
  const { socket, user } = useAuthContext();

  const currentUserName = useMemo(
    () =>
      user
        ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || "User"
        : "User",
    [user]
  );

  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const axiosConfig = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
    [token]
  );

  const requestCallApi = useCallback(
    async (toUserId) => {
      const { data } = await axios.post(
        `${BACKEND_URL}/call/request`,
        { toUserId: String(toUserId), callType: "audio" },
        axiosConfig
      );
      return data;
    },
    [axiosConfig]
  );

  const requestVideoCallApi = useCallback(
    async (toUserId) => {
      const { data } = await axios.post(
        `${BACKEND_URL}/call/request`,
        { toUserId: String(toUserId), callType: "video" },
        axiosConfig
      );
      return data;
    },
    [axiosConfig]
  );

  const inviteToCallApi = useCallback(
    async (inviteeUserId) => {
      const { data } = await axios.post(
        `${BACKEND_URL}/call/invite`,
        { inviteeUserId: String(inviteeUserId) },
        axiosConfig
      );
      return data;
    },
    [axiosConfig]
  );

  const audioCall = useAudioCall(
    socket,
    user?.id ?? user?._id,
    currentUserName,
    requestCallApi
  );

  const videoCall = useVideoCall(
    socket,
    user?.id ?? user?._id,
    currentUserName,
    requestVideoCallApi
  );

  useEffect(() => {
    if (audioCall.errorMessage) toast.error(audioCall.errorMessage);
  }, [audioCall.errorMessage]);

  useEffect(() => {
    if (videoCall.errorMessage) toast.error(videoCall.errorMessage);
  }, [videoCall.errorMessage]);

  const value = useMemo(
    () => ({ audioCall, videoCall }),
    [audioCall, videoCall]
  );

  return (
    <CallContext.Provider value={value}>
      {children}

      {/* 1-to-1 call modals: always rendered here so incoming calls show on any tab */}
      {audioCall.callState === "incoming" && (
        <IncomingCallModal
          remoteUser={audioCall.remoteUser}
          onAccept={audioCall.acceptCall}
          onReject={audioCall.rejectCall}
          errorMessage={audioCall.errorMessage}
        />
      )}
      {audioCall.callState === "calling" && (
        <OutgoingCallModal
          remoteUser={audioCall.remoteUser}
          onHangUp={audioCall.endCall}
        />
      )}
      {(audioCall.callState === "connecting" || audioCall.callState === "active") && (
        <ActiveCallBar
          remoteUser={audioCall.remoteUser}
          remoteStream={audioCall.remoteStream}
          isMuted={audioCall.isMuted}
          onToggleMute={audioCall.toggleMute}
          onHangUp={audioCall.endCall}
          isConnecting={audioCall.callState === "connecting"}
          errorMessage={audioCall.errorMessage}
        />
      )}

      {videoCall.callState === "incoming" && (
        <IncomingVideoCallModal
          remoteUser={videoCall.remoteUser}
          onAccept={videoCall.acceptCall}
          onReject={videoCall.rejectCall}
          errorMessage={videoCall.errorMessage}
        />
      )}
      {videoCall.callState === "calling" && (
        <OutgoingVideoCallModal
          remoteUser={videoCall.remoteUser}
          onHangUp={videoCall.endCall}
        />
      )}
      {(videoCall.callState === "connecting" || videoCall.callState === "active") && (
        <ActiveVideoCallBar
          remoteUser={videoCall.remoteUser}
          localStream={videoCall.localStream}
          remoteStream={videoCall.remoteStream}
          isMuted={videoCall.isMuted}
          isVideoOff={videoCall.isVideoOff}
          onToggleMute={videoCall.toggleMute}
          onToggleVideo={videoCall.toggleVideo}
          onHangUp={videoCall.endCall}
          isConnecting={videoCall.callState === "connecting"}
          errorMessage={videoCall.errorMessage}
          currentUserId={user?.id || user?._id}
          onInviteParticipant={async (userId, userName) => {
            try {
              await inviteToCallApi(userId);
              console.log("[CALL] Invited", userName, "to call");
            } catch (error) {
              console.error("[CALL] Failed to invite:", error);
              toast.error(`Failed to invite ${userName}`);
            }
          }}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCallContext() {
  return useContext(CallContext);
}
