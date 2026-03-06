import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  Send,
  Phone,
  Video,
  Check,
  CheckCheck,
  Smile,
  Paperclip,
  Loader2,
  Users,
  MessageCircle,
  Settings,
  Trash,
  Trash2,
  Eraser,
  X,
  Reply,
  Eye,
  Download,
  FileText,
  Image as ImageIcon,
  Sparkles,
  PhoneOff,
  PhoneMissed,
  PhoneIncoming,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuthContext } from "../context/AuthContextProvider";
import CreateGroupModal from "./CreateGroupModal";
import StartChatModal from "./StartChatModal";
import ChannelSettingsModal from "./ChannelSettingsModal";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallModal from "./OutgoingCallModal";
import ActiveCallBar from "./ActiveCallBar";
import GroupCallWaitingModal from "./GroupCallWaitingModal";
import GroupCallActiveBar from "./GroupCallActiveBar";
import GroupVideoCallBar from "./GroupVideoCallBar";
import GroupCallIncomingBanner from "./GroupCallIncomingBanner";
import { useAudioCall } from "../hooks/useAudioCall";
import { useVideoCall } from "../hooks/useVideoCall";
import { useGroupCall } from "../hooks/useGroupCall";
import { useCallContext } from "../context/CallContextProvider";
import ActiveVideoCallBar from "./ActiveVideoCallBar";
import IncomingVideoCallModal from "./IncomingVideoCallModal";
import OutgoingVideoCallModal from "./OutgoingVideoCallModal";

import { BACKEND_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import FileUploadModal from "./FileUploadModal";

const ChatInterface = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [userChannel, setUserChannel] = useState([]);
  const [messageSeenStatus, setMessageSeenStatus] = useState({});
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [directChats, setDirectChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [directMessageLoading, setDirectMessageLoading] = useState(true);
  const [department, setDepartment] = useState("");
  const [countryRestriction, setCountryRestriction] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [roleUpdateTrigger, setRoleUpdateTrigger] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showSeenByModal, setShowSeenByModal] = useState(false);
  const [selectedMessageSeenBy, setSelectedMessageSeenBy] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [groupCallStatus, setGroupCallStatus] = useState(null);
  const [activeGroupCalls, setActiveGroupCalls] = useState({});
  const [removedFromChannelId, setRemovedFromChannelId] = useState(null);
  const messagesEndRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const selectedChatRef = useRef(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const { socket, user } = useAuthContext();

  // Add to existing state declarations
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [searchedMessages, setSearchedMessages] = useState([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [activeReactionPicker, setActiveReactionPicker] = useState(null);
  const callStartTimeRef = useRef(null);
  const prevAudioCallStateRef = useRef("idle");
  const prevAudioRemoteUserRef = useRef(null);
  const prevVideoCallStateRef = useRef("idle");
  const prevVideoRemoteUserRef = useRef(null);

  const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const searchedMessageRefs = useRef({});
  const fetchChatSummary = async () => {
    if (!selectedChat?._id) return;
    setSummaryLoading(true);
    setShowSummaryModal(true);
    setSummaryData(null);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/ai/chatsummary/${selectedChat._id}`,
        axiosConfig
      );
      setSummaryData(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to generate summary");
      setShowSummaryModal(false);
    } finally {
      setSummaryLoading(false);
    }
  };
  // Add message search function
  const searchMessagesInChannel = async (query) => {
    if (!selectedChat?._id || !query.trim()) {
      setSearchedMessages([]);
      return;
    }

    setSearchingMessages(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/chat/channels/${
          selectedChat._id
        }/messages/search?query=${encodeURIComponent(query)}`,
        axiosConfig
      );
      setSearchedMessages(response.data.messages || []);
      setSelectedSearchIndex(0);

      // Scroll to first result if any
      if (response.data.messages?.length > 0) {
        setTimeout(() => {
          const firstMessageId = response.data.messages[0]._id;
          searchedMessageRefs.current[firstMessageId]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 100);
      }
    } catch (error) {
      console.log("first");
      console.log("Error searching messages:", error);
      toast.error("Failed to search messages");
    } finally {
      setSearchingMessages(false);
    }
  };

  // Handle search input with debounce
  const handleMessageSearchInput = (e) => {
    const query = e.target.value;
    setMessageSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchMessagesInChannel(query);
      }, 300);
    } else {
      setSearchedMessages([]);
    }
  };

  // Navigate through search results
  const navigateSearchResults = (direction) => {
    if (searchedMessages.length === 0) return;

    let newIndex = selectedSearchIndex;
    if (direction === "next") {
      newIndex = (selectedSearchIndex + 1) % searchedMessages.length;
    } else {
      newIndex =
        selectedSearchIndex === 0
          ? searchedMessages.length - 1
          : selectedSearchIndex - 1;
    }

    setSelectedSearchIndex(newIndex);
    const messageId = searchedMessages[newIndex]._id;
    searchedMessageRefs.current[messageId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  // Clear search
  const clearMessageSearch = () => {
    setMessageSearchQuery("");
    setSearchedMessages([]);
    setShowMessageSearch(false);
    setSelectedSearchIndex(0);
  };

  // Close search when chat changes
  useEffect(() => {
    clearMessageSearch();
  }, [selectedChat?._id]);

  useEffect(() => {
    if (!socket) {
      setSocketConnected(false);
      return;
    }

    const handleRoleChange = (data) => {
      console.log("Role change received:", data);
      const eventChannelId = data.channelId || data.channel_id;

      // Update userChannel with the new role
      setUserChannel((prevChannels) =>
        prevChannels.map((channel) => {
          if (channel._id === eventChannelId && channel.members) {
            return {
              ...channel,
              members: channel.members.map((member) => {
                const memberUserId = member.user_id?._id || member.user_id;
                const eventUserId =
                  data.member?.user_id?._id ||
                  data.member?.user_id ||
                  data.user_id;

                if (memberUserId === eventUserId) {
                  const newRole = data.member?.role || data.role;
                  return {
                    ...member,
                    role: newRole,
                    updatedAt: new Date().toISOString(),
                  };
                }
                return member;
              }),
            };
          }
          return channel;
        })
      );

      // Also update selectedChat if it's the current channel
      setSelectedChat((prevChat) => {
        if (prevChat?._id === eventChannelId && prevChat.members) {
          return {
            ...prevChat,
            members: prevChat.members.map((member) => {
              const memberUserId = member.user_id?._id || member.user_id;
              const eventUserId =
                data.member?.user_id?._id ||
                data.member?.user_id ||
                data.user_id;

              if (memberUserId === eventUserId) {
                const newRole = data.member?.role || data.role;
                return {
                  ...member,
                  role: newRole,
                  updatedAt: new Date().toISOString(),
                };
              }
              return member;
            }),
          };
        }
        return prevChat;
      });
    };

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    if (socket.connected) setSocketConnected(true);
    else setSocketConnected(false);

    const handleYouWereRemovedFromChannel = (data) => {
      const channelId = data.channelId || data.channel_id;
      if (!channelId) return;
      setUserChannel((prev) =>
        prev.filter((c) => String(c._id) !== String(channelId))
      );
      setRemovedFromChannelId(channelId);
    };

    const handleMemberAdded = () => {
      getUserChannel();
    };

    socket.on("changesRole", handleRoleChange);
    socket.on("roleChanged", handleRoleChange);
    socket.on("role-changed", handleRoleChange);
    socket.on("updateRole", handleRoleChange);
    socket.on("memberRoleUpdated", handleRoleChange);
    socket.on("youWereRemovedFromChannel", handleYouWereRemovedFromChannel);
    socket.on("memberAdded", handleMemberAdded);
    socket.on("member-added", handleMemberAdded);
    socket.on("addMember", handleMemberAdded);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("changesRole", handleRoleChange);
      socket.off("roleChanged", handleRoleChange);
      socket.off("role-changed", handleRoleChange);
      socket.off("updateRole", handleRoleChange);
      socket.off("memberRoleUpdated", handleRoleChange);
      socket.off("youWereRemovedFromChannel", handleYouWereRemovedFromChannel);
      socket.off("memberAdded", handleMemberAdded);
      socket.off("member-added", handleMemberAdded);
      socket.off("addMember", handleMemberAdded);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  const currentUserName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || "User"
    : "User";

  const token = localStorage.getItem("token");
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  const requestCallApi = useCallback(
    async (toUserId) => {
      try {
        const { data } = await axios.post(
          `${BACKEND_URL}/call/request`,
          { toUserId: String(toUserId), callType: "audio" },
          axiosConfig
        );
        return data;
      } catch (error) {
        if (error.response?.status === 409) {
          const errorMessage =
            error.response?.data?.message || "This person is on a call";
          toast.error(errorMessage, { duration: 1500 });
          throw new Error(errorMessage);
        }
        throw error;
      }
    },
    [token]
  );

  const requestVideoCallApi = useCallback(
    async (toUserId) => {
      try {
        const { data } = await axios.post(
          `${BACKEND_URL}/call/request`,
          { toUserId: String(toUserId), callType: "video" },
          axiosConfig
        );
        return data;
      } catch (error) {
        if (error.response?.status === 409) {
          const errorMessage =
            error.response?.data?.message || "This person is on a call";
          toast.error(errorMessage, { duration: 1500 });
          throw new Error(errorMessage);
        }
        throw error;
      }
    },
    [token]
  );

  const checkOnlineApi = useCallback(
    async (userId) => {
      const { data } = await axios.get(
        `${BACKEND_URL}/call/online/${userId}`,
        axiosConfig
      );
      return data;
    },
    [token]
  );

  const checkUserCallStatusApi = useCallback(
    async (userId) => {
      const { data } = await axios.get(
        `${BACKEND_URL}/call/status/${userId}`,
        axiosConfig
      );
      return data;
    },
    [token]
  );

  const callContext = useCallContext();
  const hasGlobalCall = Boolean(callContext?.audioCall && callContext?.videoCall);

  const localAudioCall = useAudioCall(
    socket,
    user?.id,
    currentUserName,
    requestCallApi
  );
  const localVideoCall = useVideoCall(
    socket,
    user?.id,
    currentUserName,
    requestVideoCallApi
  );

  const audioCall = hasGlobalCall ? callContext.audioCall : localAudioCall;
  const videoCall = hasGlobalCall ? callContext.videoCall : localVideoCall;
  const renderCallModals = !hasGlobalCall;

  const startGroupCallApi = useCallback(
    async (channelId) => {
      const { data } = await axios.post(
        `${BACKEND_URL}/call/group/start`,
        { channelId },
        axiosConfig
      );
      return data;
    },
    [token]
  );

  const getGroupCallStatusApi = useCallback(
    async (channelId) => {
      const { data } = await axios.get(
        `${BACKEND_URL}/call/group/status/${channelId}`,
        axiosConfig
      );
      return data;
    },
    [token]
  );

  const joinGroupCallApi = useCallback(
    async (channelId) => {
      const { data } = await axios.post(
        `${BACKEND_URL}/call/group/join`,
        { channelId },
        axiosConfig
      );
      return data;
    },
    [token]
  );

  const leaveGroupCallApi = useCallback(
    async (channelId) => {
      const { data } = await axios.post(
        `${BACKEND_URL}/call/group/leave`,
        { channelId },
        axiosConfig
      );
      return data;
    },
    [token]
  );

  const groupCall = useGroupCall(
    socket,
    user?.id,
    currentUserName,
    startGroupCallApi,
    getGroupCallStatusApi,
    joinGroupCallApi,
    leaveGroupCallApi
  );

  // Keep ref in sync so socket handlers always see the latest selectedChat
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    fetchDirectChats();
    getUserChannel();
  }, []);
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  useEffect(() => {
    if (selectedChat?._id) fetchMessages(selectedChat._id);
  }, [selectedChat?._id]);

  useEffect(() => {
    if (
      selectedChat?.channel_type === "group" &&
      selectedChat?._id &&
      getGroupCallStatusApi
    ) {
      getGroupCallStatusApi(selectedChat._id)
        .then((res) => {
          if (res?.active)
            setGroupCallStatus({
              active: true,
              channelId: res.channelId,
              channelName: res.channelName,
              initiatorId: res.initiatorId,
              initiatorName: res.initiatorName,
            });
          else setGroupCallStatus(null);
        })
        .catch(() => setGroupCallStatus(null));
    } else {
      setGroupCallStatus(null);
    }
  }, [
    selectedChat?._id,
    selectedChat?.channel_type,
    getGroupCallStatusApi,
    groupCall?.groupCallState,
  ]);

  useEffect(() => {
    if (!socket || !getGroupCallStatusApi) return;
    const checkAllGroupCalls = async () => {
      const groupChats = userChannel.filter(
        (chat) => chat.channel_type === "group"
      );
      const callStatuses = await Promise.allSettled(
        groupChats.map((chat) => getGroupCallStatusApi(chat._id))
      );
      const activeCalls = {};
      callStatuses.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value?.active)
          activeCalls[groupChats[index]._id] = true;
      });
      setActiveGroupCalls(activeCalls);
    };
    checkAllGroupCalls();
    const interval = setInterval(checkAllGroupCalls, 5000);
    const handleGroupCallStarted = ({ channelId }) =>
      setActiveGroupCalls((prev) => ({ ...prev, [channelId]: true }));
    const handleGroupCallEnded = ({ channelId }) => {
      setActiveGroupCalls((prev) => {
        const next = { ...prev };
        delete next[channelId];
        return next;
      });
      if (selectedChat?._id && String(selectedChat._id) === String(channelId))
        setGroupCallStatus(null);
    };
    socket.on("group-call-started", handleGroupCallStarted);
    socket.on("group-call-ended", handleGroupCallEnded);
    return () => {
      clearInterval(interval);
      socket.off("group-call-started", handleGroupCallStarted);
      socket.off("group-call-ended", handleGroupCallEnded);
    };
  }, [socket, userChannel, getGroupCallStatusApi, selectedChat?._id]);

  useEffect(() => {
    if (audioCall.errorMessage) toast.error(audioCall.errorMessage);
  }, [audioCall.errorMessage]);
  useEffect(() => {
    if (videoCall.errorMessage) toast.error(videoCall.errorMessage);
  }, [videoCall.errorMessage]);
  useEffect(() => {
    if (groupCall.errorMessage) toast.error(groupCall.errorMessage);
  }, [groupCall.errorMessage]);

  // Track audio call state transitions to save call logs
  useEffect(() => {
    const prevState = prevAudioCallStateRef.current;
    const prevUser = prevAudioRemoteUserRef.current;
    const currentState = audioCall.callState;

    if (currentState === "active" && prevState !== "active") {
      callStartTimeRef.current = new Date();
    }

    if (currentState === "idle" && prevState !== "idle" && prevUser) {
      const channelId = selectedChat?._id;
      if (channelId) {
        let status = "completed";
        let duration = 0;

        if (prevState === "active" && callStartTimeRef.current) {
          duration = Math.round((new Date() - callStartTimeRef.current) / 1000);
          status = "completed";
        } else if (prevState === "calling") {
          status = "no_answer";
        } else if (prevState === "incoming") {
          status = "rejected";
        } else {
          status = "missed";
        }

        saveCallLog(channelId, "audio", status, duration, prevUser.id);
        callStartTimeRef.current = null;
      }
    }

    prevAudioCallStateRef.current = currentState;
    prevAudioRemoteUserRef.current = audioCall.remoteUser;
  }, [audioCall.callState, audioCall.remoteUser]);

  // Track video call state transitions to save call logs
  useEffect(() => {
    const prevState = prevVideoCallStateRef.current;
    const prevUser = prevVideoRemoteUserRef.current;
    const currentState = videoCall.callState;

    if (currentState === "active" && prevState !== "active") {
      callStartTimeRef.current = new Date();
    }

    if (currentState === "idle" && prevState !== "idle" && prevUser) {
      const channelId = selectedChat?._id;
      if (channelId) {
        let status = "completed";
        let duration = 0;

        if (prevState === "active" && callStartTimeRef.current) {
          duration = Math.round((new Date() - callStartTimeRef.current) / 1000);
          status = "completed";
        } else if (prevState === "calling") {
          status = "no_answer";
        } else if (prevState === "incoming") {
          status = "rejected";
        } else {
          status = "missed";
        }

        saveCallLog(channelId, "video", status, duration, prevUser.id);
        callStartTimeRef.current = null;
      }
    }

    prevVideoCallStateRef.current = currentState;
    prevVideoRemoteUserRef.current = videoCall.remoteUser;
  }, [videoCall.callState, videoCall.remoteUser]);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const fetchDirectChats = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/direct_chat/list`,
        axiosConfig
      );
      setDirectChats(response.data.chats || []);
    } catch (error) {
      console.error("Error fetching direct chats:", error);
    } finally {
      setDirectMessageLoading(false);
    }
  };

  // const markMessagesAsSeenInChannel = async (channelId) => {
  //   try {
  //     await axios.post(
  //       `${BACKEND_URL}/direct_chat/channels/${channelId}/messages/seen`,
  //       {},
  //       axiosConfig
  //     );
  //     await fetchDirectChats();
  //     await getUserChannel();
  //   } catch (error) {
  //     console.error("Error marking messages as seen:", error);
  //   }
  // };

  const markMessagesAsSeenInChannel = async (channelId) => {
    // Get unseen messages before making the API call
    const unseenMessages = messages.filter(
      (msg) =>
        msg.sender_id !== user?.id &&
        !msg.seen_by?.some((s) => s.user_id._id === user?.id)
    );

    if (unseenMessages.length === 0) {
      return; // No messages to mark as seen
    }

    // Optimistically update UI immediately
    const currentUserSeenEntry = {
      user_id: {
        _id: user?.id,
        first_name: user?.first_name || "You",
        last_name: user?.last_name || "",
        full_name: `${user?.first_name || "You"} ${
          user?.last_name || ""
        }`.trim(),
        email: user?.email || "",
      },
      seen_at: new Date(),
    };

    setMessages((prev) =>
      prev.map((msg) => {
        // Check if this message should be marked as seen
        const shouldMarkSeen =
          msg.sender_id !== user?.id &&
          !msg.seen_by?.some((s) => s.user_id._id === user?.id);

        if (shouldMarkSeen) {
          return {
            ...msg,
            seen_by: [...(msg.seen_by || []), currentUserSeenEntry],
            seen_count: (msg.seen_count || 0) + 1,
            is_seen: true,
          };
        }
        return msg;
      })
    );

    // Now make the API call
    try {
      await axios.post(
        `${BACKEND_URL}/direct_chat/channels/${channelId}/messages/seen`,
        {},
        axiosConfig
      );
      // Socket events handle chat list updates automatically
    } catch (error) {
      console.error("Error marking messages as seen:", error);
    }
  };

  const fetchMessages = async (channelId) => {
    try {
      setLoadingMessages(true);
      const response = await axios.get(
        `${BACKEND_URL}/direct_chat/channels/${channelId}/messages`,
        axiosConfig
      );
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/direct_chat/search?query=${query}`,
        axiosConfig
      );
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => handleSearch(query), 300);
  };

  const startChat = async (user) => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${BACKEND_URL}/direct_chat/start`,
        { user_id: user._id },
        axiosConfig
      );
      if (response.data.channel) {
        if (response.data.is_new) await fetchDirectChats();
        const chatData = {
          _id: response.data.channel._id,
          channel_type: "direct",
          other_user: {
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: user.full_name,
            email: user.email,
            profile_picture: user.profile_picture || null,
          },
          unread_count: 0,
        };
        setSelectedChat(chatData);
        setShowSearchModal(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error starting chat:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectChat = async (chat) => {
    setSelectedChat(chat);
    setReplyingTo(null);
    if (chat?._id) await markMessagesAsSeenInChannel(chat._id);
  };

  const leaveGroup = async (id) => {
    try {
      await axios.post(
        `${BACKEND_URL}/chat/channels/${id}/leave`,
        {},
        axiosConfig
      );
      setSelectedChat(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to leave Group");
    }
  };

  const handleReply = (message) => setReplyingTo(message);
  const cancelReply = () => setReplyingTo(null);

  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(
        `${BACKEND_URL}/direct_chat/messages/${messageId}`,
        axiosConfig
      );
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      toast.success("Message deleted");
      await fetchDirectChats();
      await getUserChannel();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete message");
    }
  };

  const toggleReaction = async (messageId, emoji) => {
    setActiveReactionPicker(null);
    // Optimistic update
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg._id !== messageId) return msg;
        const reactions = { ...(msg.reactions || {}) };
        const userId = user?.id;
        if (reactions[emoji]?.includes(userId)) {
          reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...(reactions[emoji] || []), userId];
        }
        return { ...msg, reactions };
      })
    );
    try {
      await axios.post(
        `${BACKEND_URL}/direct_chat/messages/${messageId}/reactions`,
        { emoji },
        axiosConfig
      );
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    }
  };

  const saveCallLog = async (channelId, callType, status, durationSecs, participantId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/direct_chat/channels/${channelId}/call-log`,
        {
          call_type: callType,
          status,
          duration: durationSecs,
          started_at: callStartTimeRef.current || new Date(),
          ended_at: new Date(),
          participant_id: participantId,
        },
        axiosConfig
      );
    } catch (error) {
      console.error("Failed to save call log:", error);
    }
  };

  const formatCallDuration = (seconds) => {
    if (!seconds || seconds <= 0) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
  };

  const handleClearConversation = async () => {
    if (!selectedChat?._id) return;
    try {
      await axios.delete(
        `${BACKEND_URL}/direct_chat/channels/${selectedChat._id}/clear`,
        axiosConfig
      );
      setMessages([]);
      toast.success("Conversation cleared");
      await fetchDirectChats();
      await getUserChannel();
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to clear conversation"
      );
    }
  };

  const sendMessage = async (e) => {
    console.log({ e });
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || sendingMessage) return;
    const messageContent = newMessage.trim();
    const parentMessageId = replyingTo?._id || null;
    setNewMessage("");
    setReplyingTo(null);
    setSendingMessage(true);
    try {
      const payload = { content: messageContent };
      if (parentMessageId) payload.parent_message_id = parentMessageId;
      const response = await axios.post(
        `${BACKEND_URL}/direct_chat/channels/${selectedChat._id}/messages`,
        payload,
        axiosConfig
      );
      if (response.data.data) {
        // Use functional updater with dedup to avoid overwriting
        // messages that arrived via socket while the request was in-flight
        const newMsg = response.data.data;
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        setSendingMessage(false);
        // Socket events handle chat list updates automatically
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent);
      if (parentMessageId)
        setReplyingTo(messages.find((m) => m._id === parentMessageId));
      toast.error("Failed to send message. Please try again.");
    }
  };

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const formatDateSeparator = (date) => {
    const msgDate = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (isSameDay(msgDate, today)) return "Today";
    if (isSameDay(msgDate, yesterday)) return "Yesterday";
    return msgDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: msgDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const shouldShowDateSeparator = (messages, index) => {
    if (index === 0) return true;
    const curr = new Date(messages[index].created_at);
    const prev = new Date(messages[index - 1].created_at);
    return (
      curr.getFullYear() !== prev.getFullYear() ||
      curr.getMonth() !== prev.getMonth() ||
      curr.getDate() !== prev.getDate()
    );
  };

  const createGroup = async () => {
    const payload = {
      channel_type: "group",
      name: groupName,
      country_restriction: countryRestriction || null,
      ticket_id: ticketId || null,
      department,
      member_ids: selectedUsers.map((u) => u._id),
    };
    try {
      setCreateGroupLoading(true);
      await axios.post(`${BACKEND_URL}/chat/`, payload, axiosConfig);
      toast.success("Group created successfully!");
      await getUserChannel();
      setShowGroupModal(false);
      setGroupName("");
      setSelectedUsers([]);
      setDepartment("");
    } catch (error) {
      toast.error("Failed to create group. Please try again.");
    } finally {
      setCreateGroupLoading(false);
    }
  };

  const getUserChannel = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/chat/channels`,
        axiosConfig
      );
      setUserChannel(response.data.channels);
    } catch (error) {
      console.log({ error });
    }
  };

  const addMembersToChannel = async (channelId, memberIds) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/chat/channels/${channelId}/members`,
        { member_ids: memberIds },
        axiosConfig
      );
      if (response.data.added_members?.length > 0)
        toast.success(
          `Successfully added ${response.data.added_members.length} member(s)`
        );
      if (response.data.errors?.length > 0)
        toast.error(
          `${response.data.errors.length} member(s) could not be added`
        );
      await getUserChannel();
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to add members");
      throw error;
    }
  };

  const updateMemberRole = async (channelId, memberId, newRole) => {
    try {
      const response = await axios.put(
        `${BACKEND_URL}/chat/channels/${channelId}/members/${memberId}`,
        { role: newRole },
        axiosConfig
      );
      toast.success(`Successfully updated member role to ${newRole}`);
      await getUserChannel();
      return response.data;
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to update member role"
      );
      throw error;
    }
  };

  const removeMemberFromChannel = async (channelId, memberId) => {
    try {
      const response = await axios.delete(
        `${BACKEND_URL}/chat/channels/${channelId}/members/${memberId}`,
        axiosConfig
      );
      toast.success("Member removed successfully");
      await getUserChannel();
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to remove member");
      throw error;
    }
  };

  const isUserOnline = (userId) => onlineUsers.includes(userId?.toString());
  const showSeenByList = (message) => {
    setSelectedMessageSeenBy(message);
    setShowSeenByModal(true);
  };

  // Updated renderFileAttachment function for ChatInterface.jsx
  // This includes the Cloudinary URL fix for PDFs

  // Add this helper function at the top of your component
  const getCorrectCloudinaryUrl = (url, fileType) => {
    if (!url) return url;

    const isCloudinary = url.includes("res.cloudinary.com");
    if (!isCloudinary) return url;

    const isImage = fileType?.startsWith("image/");
    const isVideo = fileType?.startsWith("video/");

    // Fix PDFs and other non-image files that have /image/upload/
    if (!isImage && !isVideo && url.includes("/image/upload/")) {
      console.log("🔧 Fixing PDF URL from:", url);
      const fixedUrl = url.replace("/image/upload/", "/raw/upload/");
      console.log("🔧 Fixed PDF URL to:", fixedUrl);
      return fixedUrl;
    }

    return url;
  };

  // Updated renderFileAttachment function
  const renderFileAttachment = (message) => {
    if (message.message_type !== "file" || !message.file_url) return null;

    const isImage = message.file_type?.startsWith("image/");

    // ✅ Fix the URL if it's a Cloudinary URL with wrong path
    const fileUrl = getCorrectCloudinaryUrl(
      message.file_url,
      message.file_type
    );

    return (
      <div className="mt-2">
        {isImage ? (
          <div className="relative group">
            <img
              src={fileUrl}
              alt={message.file_name || "Attachment"}
              className="max-w-xs max-h-64 rounded cursor-pointer"
              onClick={() => window.open(fileUrl, "_blank")}
              onError={(e) => {
                console.error("Image failed to load:", fileUrl);
                e.target.style.display = "none";
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                // For images, open in new tab
                window.open(fileUrl, "_blank");
              }}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => {
              console.log("📥 Opening file:", {
                name: message.file_name,
                type: message.file_type,
                url: fileUrl,
                originalUrl: message.file_url,
              });
              window.open(fileUrl, "_blank");
            }}
            className="flex items-center gap-2 p-2 bg-zinc-800/60 rounded cursor-pointer hover:bg-zinc-800 transition-colors"
          >
            <FileText className="w-4 h-4 flex-shrink-0 text-indigo-400" />
            <div className="flex-1 min-w-0">
              <span className="text-sm block truncate text-zinc-200">
                {message.file_name || "Download File"}
              </span>
              {message.file_size && (
                <span className="text-xs text-zinc-500">
                  {formatFileSize(message.file_size)}
                </span>
              )}
            </div>
            <Download className="w-4 h-4 ml-auto flex-shrink-0 text-zinc-400" />
          </div>
        )}
      </div>
    );
  };

  // Also update the formatFileSize function if you don't have it
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewChat = (chat) => {
      setDirectChats((prev) => {
        if (prev.some((c) => c._id === chat._id)) return prev;
        return [chat, ...prev];
      });
    };

    const handleMessagesSeen = (data) => {
      const { channel_id, seen_by_user_id, seen_by_user, message_ids } = data;
      const currentChat = selectedChatRef.current;

      if (currentChat && currentChat._id === channel_id) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (message_ids.includes(msg._id)) {
              const existingSeen = msg.seen_by || [];
              const alreadySeen = existingSeen.some(
                (s) => s.user_id._id === seen_by_user_id
              );

              if (!alreadySeen) {
                const newSeenBy = {
                  user_id: {
                    _id: seen_by_user_id,
                    first_name: seen_by_user?.first_name || "Unknown",
                    last_name: seen_by_user?.last_name || "User",
                    full_name:
                      seen_by_user?.full_name ||
                      `${seen_by_user?.first_name || "Unknown"} ${
                        seen_by_user?.last_name || "User"
                      }`,
                    email: seen_by_user?.email || "",
                  },
                  seen_at: new Date(),
                };

                return {
                  ...msg,
                  seen_by: [...existingSeen, newSeenBy],
                  seen_count: (msg.seen_count || 0) + 1,
                };
              }
            }
            return msg;
          })
        );
      }

      fetchDirectChats();
      getUserChannel();
    };

    const appendMessage = (data) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && data.channel_id === currentChat._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data._id)) return prev;

          // ✅ Ensure file messages have proper structure
          const messageWithSender = {
            ...data,
            message_type: data.message_type || "text", // Ensure message_type is set
            sender: data.sender || {
              _id: data.sender_id,
              first_name: data.sender?.first_name || "Unknown",
              last_name: data.sender?.last_name || "User",
              full_name: data.sender?.full_name || "Unknown User",
              email: data.sender?.email || "",
              user_type: data.sender?.user_type || "user",
            },
          };
          return [...prev, messageWithSender];
        });
        if (!data.is_own) markMessagesAsSeenInChannel(data.channel_id);
      } else {
        fetchDirectChats();
        getUserChannel();
      }
      const updateChatList = (chats) =>
        chats.map((chat) => {
          if (chat._id === data.channel_id)
            return {
              ...chat,
              last_message: {
                ...data,
                sender_id: data.sender_id || chat.last_message?.sender_id,
              },
              unread_count:
                currentChat?._id === data.channel_id
                  ? 0
                  : (chat.unread_count || 0) + 1,
            };
          return chat;
        });
      setDirectChats((prev) => updateChatList(prev));
      setUserChannel((prev) => updateChatList(prev));
    };

    function handleLeaveChannel(id) {
      setUserChannel((prev) => prev.filter((channel) => channel._id !== id));
    }

    const handleOnlineUsersUpdate = (data) =>
      setOnlineUsers(data.onlineUsers || []);

    const handleChannelNameUpdate = (data) => {
      const { channel_id, name } = data;
      setUserChannel((prev) =>
        prev.map((ch) => (ch._id === channel_id ? { ...ch, name } : ch))
      );
      setDirectChats((prev) =>
        prev.map((ch) => (ch._id === channel_id ? { ...ch, name } : ch))
      );
      setSelectedChat((prev) => {
        if (prev && prev._id === channel_id) return { ...prev, name };
        return prev;
      });
    };

    const handleNewGroup = (data) => {
      console.log("handleNewGroup", data);
      setUserChannel((prev) => {
        if (prev.some((ch) => ch._id === data._id)) return prev;
        return [data, ...prev];
      });
    };

    const handleMessageDeleted = (data) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && String(currentChat._id) === String(data.channel_id)) {
        setMessages((prev) => prev.filter((m) => m._id !== data.message_id));
      }
      fetchDirectChats();
      getUserChannel();
    };

    const handleConversationCleared = (data) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && String(currentChat._id) === String(data.channel_id)) {
        setMessages([]);
      }
      fetchDirectChats();
      getUserChannel();
    };

    socket.on("channel_name_changed", handleChannelNameUpdate);
    socket.on("direct_chat_created", handleNewChat);
    socket.on("group_created", handleNewGroup);
    socket.on("new_message", appendMessage);
    socket.on("messages_seen", handleMessagesSeen);
    socket.on("leavechannel", handleLeaveChannel);
    socket.on("online-users-updated", handleOnlineUsersUpdate);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("conversation_cleared", handleConversationCleared);

    const handleReaction = (data) => {
      const currentChat = selectedChatRef.current;
      if (currentChat && String(currentChat._id) === String(data.channel_id)) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.message_id ? { ...msg, reactions: data.reactions } : msg
          )
        );
      }
    };
    socket.on("message_reaction", handleReaction);

    socket.emit("request-online-users");

    // Periodically refresh online status for reliability
    const onlineInterval = setInterval(() => {
      if (socket?.connected) socket.emit("request-online-users");
    }, 30000);

    return () => {
      socket.off("direct_chat_created", handleNewChat);
      socket.off("new_message", appendMessage);
      socket.off("messages_seen", handleMessagesSeen);
      socket.off("leavechannel", handleLeaveChannel);
      socket.off("online-users-updated", handleOnlineUsersUpdate);
      socket.off("channel_name_changed", handleChannelNameUpdate);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("conversation_cleared", handleConversationCleared);
      socket.off("message_reaction", handleReaction);
      clearInterval(onlineInterval);
    };
  }, [socket]);

  const handleFileSent = (messageData) => {
    setMessages((prev) => {
      if (prev.some((m) => m._id === messageData._id)) return prev;

      // Ensure the message has proper structure
      const formattedMessage = {
        ...messageData,
        message_type: "file", // Explicitly set message_type
        sender: messageData.sender || {
          _id: messageData.sender_id || user?.id,
          first_name: user?.first_name || "You",
          last_name: user?.last_name || "",
          full_name:
            user?.full_name ||
            `${user?.first_name || "You"} ${user?.last_name || ""}`.trim(),
          email: user?.email || "",
        },
      };

      return [...prev, formattedMessage];
    });
    fetchDirectChats();
    getUserChannel();
  };

  const sortChatsByLastMessage = (chats) =>
    [...chats].sort((a, b) => {
      const aTime = a.last_message?.created_at
        ? new Date(a.last_message.created_at).getTime()
        : new Date(a.created_at).getTime();
      const bTime = b.last_message?.created_at
        ? new Date(b.last_message.created_at).getTime()
        : new Date(b.created_at).getTime();
      return bTime - aTime;
    });

  const displayedChats = useMemo(() => {
    const allChats = [...directChats, ...userChannel].filter(Boolean);
    const uniqueChats = allChats.filter(
      (chat, index, self) =>
        chat?._id && index === self.findIndex((c) => c?._id === chat._id)
    );
    let filteredByTab = uniqueChats;
    if (activeTab === "direct")
      filteredByTab = uniqueChats.filter(
        (chat) => chat.channel_type === "direct"
      );
    else if (activeTab === "groups")
      filteredByTab = uniqueChats.filter(
        (chat) => chat.channel_type === "group"
      );
    if (chatSearchQuery.trim()) {
      const query = chatSearchQuery.toLowerCase();
      filteredByTab = filteredByTab.filter((chat) => {
        if (chat.channel_type === "direct") {
          const userName = chat.other_user?.full_name?.toLowerCase() || "";
          const userEmail = chat.other_user?.email?.toLowerCase() || "";
          return userName.includes(query) || userEmail.includes(query);
        }
        return (chat.name?.toLowerCase() || "").includes(query);
      });
    }
    return sortChatsByLastMessage(filteredByTab).filter((chat) => chat && chat._id);
  }, [directChats, userChannel, activeTab, chatSearchQuery]);

  const getChatDisplayInfo = (chat = {}) => {
    if (chat.channel_type === "direct")
      return {
        name: chat.other_user?.full_name || "Unknown User",
        subtitle: chat.other_user?.email || "",
        initials: `${chat.other_user?.first_name?.[0] || ""}${
          chat.other_user?.last_name?.[0] || ""
        }`,
        isGroup: false,
        profile_picture: chat.other_user?.profile_picture || null,
      };
    return {
      name: chat.name || "Group Chat",
      subtitle: `${chat.member_count || 0} members${
        chat.department ? ` \u00B7 ${chat.department?.name || ""}` : ""
      }`,
      initials: chat.name?.[0] || "G",
      isGroup: true,
      profile_picture: null,
    };
  };

  const openChannelSettings = () => {
    if (selectedChat?.channel_type === "group") setShowSettingsModal(true);
  };
  const getParentMessage = (parentMessageId) =>
    messages.find((m) => m._id === parentMessageId);

  return (
    <div className="flex flex-1 min-h-0 bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-zinc-950 border-r border-zinc-800/60 flex flex-col">
        <div className="p-3 border-b border-zinc-800/60">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <MessageCircle className="size-4 text-indigo-400" />
              Messages
            </h2>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                onClick={() => setShowSearchModal(true)}
              >
                New Chat
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs bg-zinc-900/60 border-zinc-700 hover:bg-zinc-800"
                onClick={() => setShowGroupModal(true)}
              >
                Group
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 mb-2.5 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800/60">
            {["all", "direct", "groups"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab
                    ? "bg-indigo-500/15 text-indigo-300 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-8 h-8 text-xs bg-zinc-900/80 border-zinc-800 placeholder:text-zinc-600 focus:border-indigo-500/50"
            />
          </div>
        </div>

        {/* Chat List */}
        <div
          className="flex-1 overflow-y-auto pb-4 pt-1 bg-zinc-950"
          style={{ overscrollBehavior: "contain" }}
        >
          {directMessageLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin mb-2" />
              <p className="text-xs text-zinc-500">Loading chats...</p>
            </div>
          ) : displayedChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <MessageCircle className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-400 font-medium">
                {chatSearchQuery ? "No results" : "No conversations"}
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {chatSearchQuery
                  ? "Try different keywords"
                  : "Start a new chat"}
              </p>
            </div>
          ) : (
            displayedChats.map((chat) => {
              const displayInfo = getChatDisplayInfo(chat);
              const userOnline =
                chat.channel_type === "direct" &&
                isUserOnline(chat.other_user?._id);
              const isActive = selectedChat?._id === chat._id;
              return (
                <div
                  key={
                    chat._id ?? `${chat.channel_type}-${chat.name ?? "chat"}`
                  }
                  onClick={() => selectChat(chat)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all border-b border-zinc-800/40 ${
                    isActive
                      ? "bg-indigo-500/10 border-l-2 border-l-indigo-500"
                      : "hover:bg-zinc-900/80"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-xs overflow-hidden ${
                        displayInfo.isGroup ? "bg-zinc-800 text-zinc-400" : "bg-indigo-500/20 text-indigo-300"
                      }`}
                    >
                      {displayInfo.isGroup ? (
                        <Users className="w-4 h-4" />
                      ) : displayInfo.profile_picture ? (
                        <img
                          src={displayInfo.profile_picture}
                          alt={displayInfo.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        displayInfo.initials
                      )}
                    </div>
                    {!displayInfo.isGroup && userOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950">
                        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3
                        className={`text-sm truncate ${
                          chat.unread_count > 0
                            ? "font-semibold text-zinc-100"
                            : "font-medium text-zinc-300"
                        }`}
                      >
                        {displayInfo.name}
                      </h3>
                      {displayInfo.isGroup && (
                        <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                          Group
                        </span>
                      )}
                    </div>
                    {/* Call indicators */}
                    {!displayInfo.isGroup &&
                      chat.other_user &&
                      audioCall.callState !== "idle" &&
                      audioCall.remoteUser &&
                      String(chat.other_user._id) ===
                        String(audioCall.remoteUser.id) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <span className="text-[10px] font-medium text-emerald-400">
                            On call
                          </span>
                        </div>
                      )}
                    {displayInfo.isGroup &&
                      chat._id &&
                      activeGroupCalls[chat._id] && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <span className="text-[10px] font-medium text-emerald-400">
                            Active call
                          </span>
                        </div>
                      )}
                    {chat.last_message && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <p
                          className={`text-xs truncate flex-1 ${
                            chat.unread_count > 0
                              ? "text-zinc-200 font-medium"
                              : "text-zinc-500"
                          }`}
                        >
                          {chat.last_message.message_type === "file" ? "📎 File" : chat.last_message.message_type === "call" ? (chat.last_message.call_log?.call_type === "video" ? " Video call" : " Audio call") : chat.last_message.content}
                        </p>
                        {chat.unread_count > 0 && (
                          <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] rounded-full font-semibold min-w-[18px] text-center">
                            {chat.unread_count > 99 ? "99+" : chat.unread_count}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-zinc-900/50">
          {/* Chat Header */}
          <div className="relative">
          <div className="h-14 px-4 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-xs overflow-hidden ${
                    selectedChat.channel_type === "group"
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-indigo-500/20 text-indigo-300"
                  }`}
                >
                  {selectedChat.channel_type === "group" ? (
                    <Users className="w-4 h-4" />
                  ) : selectedChat.other_user?.profile_picture ? (
                    <img
                      src={selectedChat.other_user.profile_picture}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      {selectedChat.other_user?.first_name?.[0]}
                      {selectedChat.other_user?.last_name?.[0]}
                    </>
                  )}
                </div>
                {selectedChat.channel_type === "direct" &&
                  isUserOnline(selectedChat.other_user?._id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950">
                      <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-40" />
                    </div>
                  )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {selectedChat.channel_type === "group"
                    ? selectedChat.name
                    : selectedChat.other_user?.full_name}
                </h3>
                <p className="text-xs">
                  {selectedChat.channel_type === "group"
                    ? <span className="text-zinc-500">{`${selectedChat.member_count || 0} members${
                        selectedChat.department
                          ? ` · ${selectedChat.department?.name || ""}`
                          : ""
                      }`}</span>
                    : isUserOnline(selectedChat.other_user?._id)
                    ? <span className="text-emerald-400 flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Active now</span>
                    : <span className="text-zinc-500">Offline</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Search Button */}
              <button
                onClick={() => setShowMessageSearch(!showMessageSearch)}
                className={`p-1.5 rounded-lg transition-all ${
                  showMessageSearch
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
                title="Search messages"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={fetchChatSummary}
                className="p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-lg transition-all"
                title="Summarize unseen messages"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              {selectedChat.channel_type === "direct" &&
                selectedChat.other_user && (
                  <>
                    <button
                      onClick={async () => {
                        if (!isUserOnline(selectedChat.other_user._id)) {
                          toast.error("User is offline", { duration: 1500 });
                          return;
                        }
                        if (groupCall.groupCallState !== "idle") {
                          toast.error("You are currently in a group call", {
                            duration: 1500,
                          });
                          return;
                        }
                        if (
                          videoCall.callState !== "idle" &&
                          !(
                            String(selectedChat.other_user._id) ===
                            String(videoCall.remoteUser?.id)
                          )
                        ) {
                          toast.error("You are already in a call", {
                            duration: 1500,
                          });
                          return;
                        }
                        try {
                          const callStatus = await checkUserCallStatusApi(
                            selectedChat.other_user._id
                          );
                          if (callStatus.inCall) {
                            toast.error(
                              `${
                                selectedChat.other_user.first_name ||
                                "This person"
                              } is on a call`,
                              { duration: 1500 }
                            );
                            return;
                          }
                          audioCall.startCall(
                            String(selectedChat.other_user._id),
                            selectedChat.other_user.full_name ||
                              `${selectedChat.other_user.first_name || ""} ${
                                selectedChat.other_user.last_name || ""
                              }`.trim()
                          );
                        } catch (error) {
                          audioCall.startCall(
                            String(selectedChat.other_user._id),
                            selectedChat.other_user.full_name ||
                              `${selectedChat.other_user.first_name || ""} ${
                                selectedChat.other_user.last_name || ""
                              }`.trim()
                          );
                        }
                      }}
                      disabled={
                        audioCall.callState !== "idle" ||
                        videoCall.callState !== "idle" ||
                        !socket ||
                        groupCall.groupCallState !== "idle" ||
                        !isUserOnline(selectedChat.other_user._id)
                      }
                      className="p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-lg transition-all disabled:opacity-40"
                      title={
                        !isUserOnline(selectedChat.other_user._id)
                          ? "User is offline"
                          : groupCall.groupCallState !== "idle"
                          ? "You are in a group call"
                          : videoCall.callState !== "idle"
                          ? "You are in a video call"
                          : audioCall.callState !== "idle"
                          ? "You are in a call"
                          : "Audio call"
                      }
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!isUserOnline(selectedChat.other_user._id)) {
                          toast.error("User is offline", { duration: 1500 });
                          return;
                        }
                        if (groupCall.groupCallState !== "idle") {
                          toast.error("You are currently in a group call", {
                            duration: 1500,
                          });
                          return;
                        }
                        if (
                          audioCall.callState !== "idle" &&
                          !(
                            String(selectedChat.other_user._id) ===
                            String(audioCall.remoteUser?.id)
                          )
                        ) {
                          toast.error("You are already in a call", {
                            duration: 1500,
                          });
                          return;
                        }
                        if (
                          videoCall.callState !== "idle" &&
                          !(
                            String(selectedChat.other_user._id) ===
                            String(videoCall.remoteUser?.id)
                          )
                        ) {
                          toast.error("You are already in a call", {
                            duration: 1500,
                          });
                          return;
                        }
                        try {
                          const callStatus = await checkUserCallStatusApi(
                            selectedChat.other_user._id
                          );
                          if (callStatus.inCall) {
                            toast.error(
                              `${
                                selectedChat.other_user.first_name ||
                                "This person"
                              } is on a call`,
                              { duration: 1500 }
                            );
                            return;
                          }
                          videoCall.startCall(
                            String(selectedChat.other_user._id),
                            selectedChat.other_user.full_name ||
                              `${selectedChat.other_user.first_name || ""} ${
                                selectedChat.other_user.last_name || ""
                              }`.trim()
                          );
                        } catch (error) {
                          console.error("Error checking call status:", error);
                          videoCall.startCall(
                            String(selectedChat.other_user._id),
                            selectedChat.other_user.full_name ||
                              `${selectedChat.other_user.first_name || ""} ${
                                selectedChat.other_user.last_name || ""
                              }`.trim()
                          );
                        }
                      }}
                      disabled={
                        (audioCall.callState !== "idle" &&
                          !(
                            selectedChat.channel_type === "direct" &&
                            selectedChat.other_user &&
                            String(selectedChat.other_user._id) ===
                              String(audioCall.remoteUser?.id)
                          )) ||
                        (videoCall.callState !== "idle" &&
                          !(
                            selectedChat.channel_type === "direct" &&
                            selectedChat.other_user &&
                            String(selectedChat.other_user._id) ===
                              String(videoCall.remoteUser?.id)
                          )) ||
                        groupCall.groupCallState !== "idle" ||
                        !isUserOnline(selectedChat.other_user._id)
                      }
                      className="p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-lg transition-all disabled:opacity-40"
                      title={
                        !isUserOnline(selectedChat.other_user._id)
                          ? "User is offline"
                          : groupCall.groupCallState !== "idle"
                          ? "You are in a group call"
                          : videoCall.callState !== "idle" &&
                            String(selectedChat.other_user._id) !==
                              String(videoCall.remoteUser?.id)
                          ? "You are in a video call"
                          : audioCall.callState !== "idle" &&
                            String(selectedChat.other_user._id) !==
                              String(audioCall.remoteUser?.id)
                          ? "You are in a call"
                          : "Video call"
                      }
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </>
                )}
              {selectedChat.channel_type === "group" && (
                <>
                  <button
                    onClick={() =>
                      groupCall.startGroupCall(
                        selectedChat._id,
                        selectedChat.name
                      )
                    }
                    disabled={
                      groupCall.groupCallState !== "idle" ||
                      audioCall.callState !== "idle" ||
                      videoCall.callState !== "idle"
                    }
                    className="p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-lg transition-all disabled:opacity-40"
                    title="Start video call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                  {groupCall.groupCallState === "idle" &&
                    !groupCallStatus?.active &&
                    selectedChat.user_role === "admin" && (
                      <button
                        onClick={() =>
                          groupCall.startGroupCall(
                            selectedChat._id,
                            selectedChat.name
                          )
                        }
                        disabled={
                          !socket ||
                          groupCall.groupCallState !== "idle" ||
                          audioCall.callState !== "idle"
                        }
                        className="p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-lg transition-all disabled:opacity-40"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    )}
                  <button
                    onClick={openChannelSettings}
                    className="p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-lg transition-all"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </>
              )}
              {selectedChat?.member_count > 2 && (
                <button
                  onClick={() => leaveGroup(selectedChat._id)}
                  className="p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                >
                  <Trash className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to clear all messages in this conversation? This cannot be undone."
                    )
                  ) {
                    handleClearConversation();
                  }
                }}
                className="p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                title="Clear conversation"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Header accent line */}
          <div className="h-[2px] bg-gradient-to-r from-indigo-600/60 via-purple-500/40 to-transparent" />
          </div>

          {/* Message Search Bar */}
          {showMessageSearch && (
            <div className="px-4 py-2 bg-zinc-900/80 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <Input
                    type="text"
                    value={messageSearchQuery}
                    onChange={handleMessageSearchInput}
                    placeholder="Search in conversation..."
                    className="pl-8 h-8 text-xs bg-zinc-900/80 border-zinc-800 placeholder:text-zinc-600 focus:border-indigo-500/50"
                    autoFocus
                  />
                  {searchingMessages && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 animate-spin" />
                  )}
                </div>

                {searchedMessages.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400 whitespace-nowrap">
                      {selectedSearchIndex + 1} of {searchedMessages.length}
                    </span>
                    <button
                      onClick={() => navigateSearchResults("prev")}
                      className="p-1 hover:bg-zinc-800 rounded transition"
                      disabled={searchedMessages.length === 0}
                    >
                      <svg
                        className="w-3.5 h-3.5 text-zinc-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => navigateSearchResults("next")}
                      className="p-1 hover:bg-zinc-800 rounded transition"
                      disabled={searchedMessages.length === 0}
                    >
                      <svg
                        className="w-3.5 h-3.5 text-zinc-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                )}

                <button
                  onClick={clearMessageSearch}
                  className="p-1 hover:bg-zinc-800 rounded transition"
                >
                  <X className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              </div>
            </div>
          )}

          {/* Group Call Banner */}
          {((groupCall.groupCallState === "incoming" &&
            selectedChat?._id &&
            String(selectedChat._id) === String(groupCall.activeChannelId)) ||
            (groupCall.groupCallState === "idle" &&
              groupCallStatus?.active &&
              selectedChat?._id &&
              String(selectedChat._id) ===
                String(groupCallStatus.channelId))) &&
          groupCall.groupCallState !== "waiting" &&
          groupCall.groupCallState !== "active" &&
          groupCall.groupCallState !== "joined" ? (
            <div className="px-4 pt-2">
              <GroupCallIncomingBanner
                channelName={
                  groupCall.groupCallState === "incoming"
                    ? groupCall.activeChannelName
                    : groupCallStatus?.channelName
                }
                initiatorName={
                  groupCall.groupCallState === "incoming"
                    ? groupCall.initiatorName
                    : groupCallStatus?.initiatorName
                }
                onJoin={() => {
                  if (
                    groupCall.groupCallState !== "idle" &&
                    groupCall.groupCallState !== "incoming"
                  ) {
                    toast.error("You are currently in a group call", {
                      duration: 1500,
                    });
                    return;
                  }
                  groupCall.joinGroupCall(
                    groupCall.groupCallState === "incoming"
                      ? groupCall.activeChannelId
                      : groupCallStatus.channelId,
                    groupCall.groupCallState === "incoming"
                      ? groupCall.activeChannelName
                      : groupCallStatus.channelName,
                    groupCall.groupCallState === "incoming"
                      ? groupCall.initiatorId
                      : groupCallStatus.initiatorId,
                    groupCall.groupCallState === "incoming"
                      ? groupCall.initiatorName
                      : groupCallStatus.initiatorName
                  );
                }}
                onDismiss={
                  groupCall.groupCallState === "incoming"
                    ? groupCall.dismissIncoming
                    : () => {}
                }
              />
            </div>
          ) : null}

          {/* Messages Area */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-zinc-900/40"
            style={{ overscrollBehavior: "contain" }}
          >
            {removedFromChannelId &&
            selectedChat?._id &&
            String(selectedChat._id) === String(removedFromChannelId) ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
                <p className="text-base font-medium text-amber-400">
                  You are removed from this group
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  You will no longer see this chat after you refresh.
                </p>
              </div>
            ) : loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-14 h-14 rounded-full bg-zinc-800/80 flex items-center justify-center mb-3">
                  <Send className="w-6 h-6 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-300 font-medium">
                  Start the conversation
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {selectedChat.channel_type === "group"
                    ? `Send a message to ${selectedChat.name}`
                    : `Send a message to ${selectedChat.other_user?.first_name}`}
                </p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  const parentMessage = message.parent_message_id
                    ? getParentMessage(message.parent_message_id)
                    : null;
                  const senderName = message.sender
                    ? `${message.sender.first_name || ""} ${
                        message.sender.last_name || ""
                      }`.trim() || "User"
                    : "User";

                  const isSearchResult = searchedMessages.some(
                    (m) => m._id === message._id
                  );
                  const isCurrentSearchResult =
                    searchedMessages.length > 0 &&
                    searchedMessages[selectedSearchIndex]?._id === message._id;

                  const showDateSep = shouldShowDateSeparator(messages, index);

                  return (
                    <React.Fragment key={message._id}>
                      {showDateSep && (
                        <div className="flex items-center gap-3 my-3">
                          <div className="flex-1 h-px bg-zinc-800" />
                          <span className="text-[11px] font-medium text-zinc-500 bg-zinc-900/80 px-2.5 py-0.5 rounded-full">
                            {formatDateSeparator(message.created_at)}
                          </span>
                          <div className="flex-1 h-px bg-zinc-800" />
                        </div>
                      )}
                    {/* Call message rendering */}
                    {message.message_type === "call" ? (
                      <div className="flex justify-center">
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-800/60 border border-zinc-700/40 rounded-xl max-w-xs">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            message.call_log?.status === "completed" ? "bg-emerald-500/15" :
                            message.call_log?.status === "missed" ? "bg-red-500/15" :
                            message.call_log?.status === "rejected" ? "bg-amber-500/15" : "bg-zinc-700/50"
                          }`}>
                            {message.call_log?.status === "completed" ? (
                              message.call_log?.call_type === "video" ? <Video className="w-4 h-4 text-emerald-400" /> : <Phone className="w-4 h-4 text-emerald-400" />
                            ) : message.call_log?.status === "missed" ? (
                              <PhoneMissed className="w-4 h-4 text-red-400" />
                            ) : message.call_log?.status === "rejected" ? (
                              <PhoneOff className="w-4 h-4 text-amber-400" />
                            ) : (
                              <PhoneOff className="w-4 h-4 text-zinc-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-zinc-200">{message.content}</p>
                            <p className="text-[10px] text-zinc-500">
                              {message.is_own ? "You" : senderName} · {formatTime(message.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                    <div
                      ref={(el) => {
                        if (isSearchResult) {
                          searchedMessageRefs.current[message._id] = el;
                        }
                      }}
                      className={`flex ${
                        message.is_own ? "justify-end" : "justify-start"
                      } ${isCurrentSearchResult ? "animate-pulse" : ""}`}
                    >
                      <div className="group relative max-w-md">
                        <div
                          className={`px-3.5 py-2 rounded-xl text-sm transition-all ${
                            message.is_own
                              ? "bg-indigo-600 text-white"
                              : "bg-zinc-800/80 border border-zinc-700/50 text-zinc-100"
                          } ${
                            isCurrentSearchResult
                              ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900"
                              : isSearchResult
                              ? "ring-1 ring-yellow-400/50"
                              : ""
                          }`}
                        >
                          {/* Rest of your existing message rendering... */}
                          {parentMessage && (
                            <div
                              className={`mb-1.5 pl-2.5 border-l-2 ${
                                message.is_own
                                  ? "border-white/40"
                                  : "border-indigo-400"
                              } py-0.5`}
                            >
                              <p
                                className={`text-[11px] font-medium ${
                                  message.is_own
                                    ? "text-white/70"
                                    : "text-indigo-400"
                                }`}
                              >
                                {parentMessage.is_own
                                  ? "You"
                                  : parentMessage.sender?.first_name || "User"}
                              </p>
                              <p
                                className={`text-[11px] truncate ${
                                  message.is_own
                                    ? "text-white/60"
                                    : "text-zinc-500"
                                }`}
                              >
                                {parentMessage.content}
                              </p>
                            </div>
                          )}
                          {!message.is_own &&
                            selectedChat.channel_type === "group" && (
                              <p className="text-[11px] font-semibold text-indigo-400 mb-0.5">
                                {senderName}
                              </p>
                            )}
                          <p className="leading-relaxed">{message.content}</p>
                          {renderFileAttachment(message)}
                          <div
                            className={`flex items-center gap-1 justify-end mt-1 ${
                              message.is_own
                                ? "text-indigo-200/60"
                                : "text-zinc-500"
                            }`}
                          >
                            <span className="text-[10px]">
                              {formatTime(message.created_at)}
                            </span>
                            {message.is_own &&
                              (message.seen_count > 0 ? (
                                <button
                                  onClick={() => showSeenByList(message)}
                                  className="flex items-center gap-0.5 hover:opacity-80"
                                >
                                  <CheckCheck className="w-3 h-3 text-blue-400" />
                                  {selectedChat?.channel_type === "group" &&
                                    message.seen_count > 0 && (
                                      <span className="text-[10px]">
                                        {message.seen_count}
                                      </span>
                                    )}
                                </button>
                              ) : (
                                <Check className="w-3 h-3 text-indigo-200/40" />
                              ))}
                          </div>
                        </div>
                        {/* Message actions on hover */}
                        <div className={`absolute ${message.is_own ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"} top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5`}>
                          <button
                            onClick={() => setActiveReactionPicker(activeReactionPicker === message._id ? null : message._id)}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="React"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleReply(message)}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="Reply"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          {message.is_own && (
                            <button
                              onClick={() => handleDeleteMessage(message._id)}
                              className="p-1 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {/* Reaction picker popup */}
                        {activeReactionPicker === message._id && (
                          <div className={`absolute ${message.is_own ? "right-0" : "left-0"} -top-9 z-10 flex items-center gap-0.5 bg-zinc-800 border border-zinc-700/60 rounded-full px-1.5 py-1 shadow-xl`}>
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(message._id, emoji)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-700 transition-colors text-sm hover:scale-110"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Reactions display */}
                        {message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${message.is_own ? "justify-end" : "justify-start"}`}>
                            {Object.entries(message.reactions).map(([emoji, userIds]) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(message._id, emoji)}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                  userIds.includes(user?.id)
                                    ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                                    : "bg-zinc-800/80 border-zinc-700/40 text-zinc-400 hover:border-zinc-600"
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px]">{userIds.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Reply Bar */}
          {replyingTo && (
            <div className="px-4 py-2 bg-zinc-900/80 border-t border-zinc-800/60 flex items-center justify-between">
              <div className="flex-1 flex items-start gap-2">
                <Reply className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200">
                    Replying to{" "}
                    {replyingTo.is_own
                      ? "yourself"
                      : replyingTo.sender?.first_name || "User"}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {replyingTo.content}
                  </p>
                </div>
              </div>
              <button
                onClick={cancelReply}
                className="p-1 hover:bg-zinc-800 rounded transition"
              >
                <X className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
          )}

          {/* Message Input - hidden when user was removed from this group */}
          {!(
            removedFromChannelId &&
            selectedChat?._id &&
            String(selectedChat._id) === String(removedFromChannelId)
          ) && (
            <div className="px-4 pt-3 pb-1 border-t border-zinc-800/60 bg-zinc-950">
              {!socketConnected && (
                <div className="mb-2 flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                  <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                  Connecting to chat...
                </div>
              )}
              <form onSubmit={sendMessage} className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setShowFileUpload(true)}
                  disabled={!socketConnected}
                  title="Send file"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>

                <Input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    !socketConnected
                      ? "Connecting..."
                      : replyingTo
                      ? "Type your reply..."
                      : "Type a message..."
                  }
                  disabled={sendingMessage || !socketConnected}
                  className="flex-1 bg-zinc-900/80 border-zinc-800 placeholder:text-zinc-600 focus:border-indigo-500/50"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={
                    !newMessage.trim() || sendingMessage || !socketConnected
                  }
                  className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                >
                  {sendingMessage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/30">
          <div className="w-16 h-16 rounded-full bg-zinc-800/80 flex items-center justify-center mb-4">
            <MessageCircle className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-200 mb-1">
            Select a conversation
          </h3>
          <p className="text-sm text-zinc-500 mb-4">
            Choose a chat or start a new one
          </p>
          <Button 
            onClick={() => setShowSearchModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Start New Chat
          </Button>
        </div>
      )}

      {/* Seen By Modal */}
      {showSeenByModal && selectedMessageSeenBy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800/80 shadow-xl max-w-sm w-full max-h-[70vh] flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Seen by
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSeenByModal(false)}
                className="hover:bg-zinc-800"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {selectedMessageSeenBy.seen_by?.length > 0 ? (
                <div className="space-y-1">
                  {selectedMessageSeenBy.seen_by.map((seen, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/50"
                    >
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-300 font-medium text-[10px]">
                          {seen.user_id?.first_name?.[0] || "U"}
                          {seen.user_id?.last_name?.[0] || ""}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {seen.user_id?.first_name || "Unknown"}{" "}
                          {seen.user_id?.last_name || ""}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {new Date(seen.seen_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Eye className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">
                    No one has seen this yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <StartChatModal
        show={showSearchModal}
        onClose={() => {
          setShowSearchModal(false);
          setSearchQuery("");
          setSearchResults([]);
        }}
        searchQuery={searchQuery}
        handleSearchInput={handleSearchInput}
        searchResults={searchResults}
        isSearching={isSearching}
        startChat={startChat}
        loading={loading}
      />
      <CreateGroupModal
        show={showGroupModal}
        onClose={() => {
          setShowGroupModal(false);
          setSearchQuery("");
          setSearchResults([]);
          setSelectedUsers([]);
          setGroupName("");
        }}
        groupName={groupName}
        setGroupName={setGroupName}
        searchQuery={searchQuery}
        setDepartment={setDepartment}
        handleSearchInput={handleSearchInput}
        searchResults={searchResults}
        selectedUsers={selectedUsers}
        setSelectedUsers={setSelectedUsers}
        isSearching={isSearching}
        createGroupLoading={createGroupLoading}
        createGroup={createGroup}
      />
      <ChannelSettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        channel={selectedChat}
        onAddMembers={addMembersToChannel}
        onUpdateRole={updateMemberRole}
        onRemoveMember={removeMemberFromChannel}
        handleSearch={handleSearch}
        searchResults={searchResults}
        isSearching={isSearching}
        roleUpdateTrigger={roleUpdateTrigger}
      />

      {renderCallModals && audioCall.callState === "incoming" && (
        <IncomingCallModal
          remoteUser={audioCall.remoteUser}
          onAccept={audioCall.acceptCall}
          onReject={audioCall.rejectCall}
          errorMessage={audioCall.errorMessage}
        />
      )}
      {renderCallModals && audioCall.callState === "calling" && (
        <OutgoingCallModal
          remoteUser={audioCall.remoteUser}
          onHangUp={audioCall.endCall}
        />
      )}
      {renderCallModals &&
        (audioCall.callState === "connecting" ||
          audioCall.callState === "active") && (
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

      {renderCallModals && videoCall.callState === "incoming" && (
        <IncomingVideoCallModal
          remoteUser={videoCall.remoteUser}
          onAccept={videoCall.acceptCall}
          onReject={videoCall.rejectCall}
          errorMessage={videoCall.errorMessage}
        />
      )}
      {renderCallModals && videoCall.callState === "calling" && (
        <OutgoingVideoCallModal
          remoteUser={videoCall.remoteUser}
          onHangUp={videoCall.endCall}
        />
      )}
      {renderCallModals &&
        (videoCall.callState === "connecting" ||
          videoCall.callState === "active") && (
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
          />
        )}

      {groupCall.groupCallState === "waiting" && (
        <GroupCallWaitingModal
          channelName={groupCall.activeChannelName}
          onCancel={groupCall.leaveGroupCall}
        />
      )}
      {(groupCall.groupCallState === "active" ||
        groupCall.groupCallState === "joined") && (
        <GroupVideoCallBar
          channelName={groupCall.activeChannelName}
          participants={groupCall.participants}
          localStream={groupCall.localStream}
          remoteStreams={groupCall.remoteStreams}
          isMuted={groupCall.isMuted}
          isVideoOff={groupCall.isVideoOff}
          onToggleMute={groupCall.toggleMute}
          onToggleVideo={groupCall.toggleVideo}
          onHangUp={groupCall.leaveGroupCall}
          currentUserId={user?.id}
          isConnecting={groupCall.groupCallState === "waiting"}
        />
      )}
      <FileUploadModal
        show={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        selectedChat={selectedChat}
        onFileSent={handleFileSent}
      />
      {/* Chat Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800/80 shadow-xl max-w-md w-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Unseen Messages Summary
                </h3>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-1 hover:bg-zinc-800 rounded transition"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4">
              {summaryLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <p className="text-sm text-zinc-500">
                    Generating summary...
                  </p>
                </div>
              ) : summaryData?.summary === null ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCheck className="w-8 h-8 text-emerald-500" />
                  <p className="text-sm font-medium text-zinc-200">
                    You're all caught up!
                  </p>
                  <p className="text-xs text-zinc-500 text-center">
                    No unseen messages in this conversation.
                  </p>
                </div>
              ) : summaryData ? (
                <div className="space-y-3">
                  {/* Unseen count badge */}
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 text-xs font-medium rounded-full">
                      {summaryData.unseen_count} unseen{" "}
                      {summaryData.unseen_count === 1 ? "message" : "messages"}
                    </span>
                    {summaryData.channel?.name && (
                      <span className="text-xs text-zinc-500 truncate">
                        in {summaryData.channel.name}
                      </span>
                    )}
                  </div>

                  {/* Summary text */}
                  <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                    <p className="text-sm text-zinc-200 leading-relaxed">
                      {summaryData.summary}
                    </p>
                  </div>

                  {/* Footer note */}
                  <p className="text-[11px] text-zinc-600 text-center">
                    Generated by AI · May not capture every detail
                  </p>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            {!summaryLoading && summaryData && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
};

export default ChatInterface;
