import React, { useState, useEffect, useRef } from "react";

const MentionAutocomplete = ({
  query,
  onSelect,
  isOpen,
  groupMembers = [],
  excludedUsers = [],
  maxResults = 12,
}) => {
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef(null);

  // Filter users based on query
  useEffect(() => {
    // Only show if open and have members
    if (!isOpen) {
      setFilteredUsers([]);
      return;
    }

    if (!groupMembers || groupMembers.length === 0) {
      setFilteredUsers([]);
      return;
    }

    console.log("Members available:", groupMembers); // Debug

    const normalizedExcludedUsers = excludedUsers.map((id) => String(id));

    // Filter out excluded users
    let filtered = groupMembers.filter((user) => {
      const candidateId = String(user?._id || user?.user_id?._id || user?.user_id || "");
      return candidateId && !normalizedExcludedUsers.includes(candidateId);
    });

    // If query exists, filter by name/email
    if (query && query.trim().length > 0) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter((user) => {
        const firstName = (user.first_name || user.user_id?.first_name || "").toLowerCase();
        const lastName = (user.last_name || user.user_id?.last_name || "").toLowerCase();
        const email = (user.email || user.user_id?.email || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.toLowerCase();

        return (
          firstName.includes(searchTerm) ||
          lastName.includes(searchTerm) ||
          fullName.includes(searchTerm) ||
          email.includes(searchTerm)
        );
      });
    }

    // Limit results
    setFilteredUsers(filtered.slice(0, maxResults));
    setSelectedIndex(0);

    console.log("Filtered users:", filtered.slice(0, maxResults)); // Debug
  }, [query, isOpen, groupMembers, excludedUsers, maxResults]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || filteredUsers.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredUsers.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredUsers[selectedIndex]) {
          onSelect(filteredUsers[selectedIndex]);
        }
        break;
      case "Escape":
        setFilteredUsers([]);
        break;
      default:
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0) {
      const selectedElement = containerRef.current.children[selectedIndex];
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) {
    return null;
  }

  // Always render the container, even if empty (for debugging and showing "no results")
  if (!groupMembers || groupMembers.length === 0) {
    return (
      <div className="absolute bottom-full mb-2 left-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-3 text-xs text-zinc-400 whitespace-nowrap">
        No group members available
      </div>
    );
  }

  // If we have members but no filtered results
  if (filteredUsers.length === 0) {
    return (
      <div className="absolute bottom-full mb-2 left-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-3 text-xs text-zinc-400 whitespace-nowrap">
        No members match "{query}"
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 max-w-sm bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50"
      onKeyDown={handleKeyDown}
    >
      {filteredUsers.map((user, index) => {
        const firstName = user.first_name || user.user_id?.first_name || "User";
        const lastName = user.last_name || user.user_id?.last_name || "";
        const email = user.email || user.user_id?.email || "";
        const fullName = `${firstName} ${lastName}`.trim();

        return (
          <button
            key={user._id}
            onClick={() => onSelect(user)}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-zinc-700/50 last:border-0 ${
              index === selectedIndex
                ? "bg-indigo-600 text-white"
                : "hover:bg-zinc-700 text-zinc-200"
            }`}
          >
            <div className="font-medium">@{firstName}</div>
            <div className="text-xs opacity-70 mt-0.5">{email}</div>
          </button>
        );
      })}
    </div>
  );
};

export default MentionAutocomplete;
