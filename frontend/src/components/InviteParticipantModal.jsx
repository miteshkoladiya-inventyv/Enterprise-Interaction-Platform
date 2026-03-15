import React, { useState, useEffect, useRef } from "react";
import { X, Search, Loader2, UserPlus, Users } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { BACKEND_URL } from "@/config";

/**
 * Modal to search and invite participants to an ongoing call
 * @param {boolean} isOpen - Modal visibility
 * @param {function} onClose - Callback to close modal
 * @param {function} onInvite - Callback when user invites someone - receives (userId, userName)
 * @param {array} excludeUserIds - User IDs to exclude from search (current call participants)
 * @param {object} authHeader - Authorization headers {Authorization: 'Bearer token'}
 */
const InviteParticipantModal = ({
  isOpen,
  onClose,
  onInvite,
  excludeUserIds = [],
  authHeader = {},
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, isSerching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const searchTimeoutRef = useRef(null);

  // Search for users/employees when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    isSerching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Try to fetch from employee endpoint or user search
        const { data } = await axios.get(
          `${BACKEND_URL}/helper/search-users?query=${encodeURIComponent(searchQuery)}&limit=20`,
          { headers: authHeader }
        );

        // Filter out already-in-call participants
        const filtered = (data.users || data || []).filter(
          (u) => !excludeUserIds.includes(u._id) && !excludeUserIds.includes(u.id)
        );

        setSearchResults(filtered);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        isSerching(false);
      }
    }, 500); // Debounce 500ms

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, excludeUserIds, authHeader]);

  const handleSelectUser = (user) => {
    // Check if already selected
    const alreadySelected = selectedUsers.some(
      (u) => (u._id || u.id) === (user._id || user.id)
    );

    if (alreadySelected) {
      setSelectedUsers((prev) =>
        prev.filter((u) => (u._id || u.id) !== (user._id || user.id))
      );
    } else {
      setSelectedUsers((prev) => [...prev, user]);
    }
  };

  const handleInviteAll = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one participant");
      return;
    }

    try {
      for (const user of selectedUsers) {
        const userId = user._id || user.id;
        const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.name || "User";
        if (onInvite) {
          onInvite(userId, userName, user);
        }
      }
      toast.success(`Invited ${selectedUsers.length} participant(s)`);
      setSelectedUsers([]);
      setSearchQuery("");
      onClose();
    } catch (error) {
      toast.error("Failed to invite participants");
      console.error(error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full border border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Invite Participants</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Search Box */}
        <div className="px-6 py-4 border-b border-zinc-700">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Search Results */}
        <div className="max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="divide-y divide-zinc-700">
              {searchResults.map((user) => {
                const userId = user._id || user.id;
                const isSelected = selectedUsers.some(
                  (u) => (u._id || u.id) === userId
                );
                const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.name || "User";
                const userEmail = user.email || "";
                const userAvatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&size=40&background=6366f1&color=fff`;

                return (
                  <div
                    key={userId}
                    onClick={() => handleSelectUser(user)}
                    className={`px-6 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-500/20 border-l-2 border-indigo-500"
                        : "bg-zinc-800/50 hover:bg-zinc-800"
                    }`}
                  >
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{userName}</p>
                      <p className="text-xs text-zinc-400 truncate">{userEmail}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-indigo-500 border-indigo-500"
                          : "border-zinc-600 hover:border-zinc-400"
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : searchQuery.trim() ? (
            <div className="px-6 py-12 text-center">
              <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No users found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Search className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">Search for participants to invite</p>
            </div>
          )}
        </div>

        {/* Selected Count */}
        {selectedUsers.length > 0 && (
          <div className="px-6 py-3 bg-zinc-800 border-t border-zinc-700">
            <p className="text-sm text-zinc-400">
              {selectedUsers.length} participant{selectedUsers.length !== 1 ? "s" : ""} selected
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleInviteAll}
            disabled={selectedUsers.length === 0}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors font-medium"
          >
            Invite ({selectedUsers.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteParticipantModal;
