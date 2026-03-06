// import React, { useState, useEffect } from "react";
// import {
//   X,
//   Search,
//   UserPlus,
//   Loader2,
//   Shield,
//   User,
//   Crown,
//   Trash2,
//   ChevronDown,
//   Edit2,
//   Check,
// } from "lucide-react";
// import { useAuthContext } from "../context/AuthContextProvider";
// import toast from "react-hot-toast";
// import axios from "axios";
// import { BACKEND_URL } from "../../config";

// const ChannelSettingsModal = ({
//   show,
//   onClose,
//   channel,
//   onAddMembers,
//   onUpdateRole,
//   onRemoveMember,
//   handleSearch,
//   searchResults,
//   isSearching,
//   roleUpdateTrigger,
// }) => {
//   const [activeTab, setActiveTab] = useState("members");
//   const [searchQuery, setSearchQuery] = useState("");
//   const [selectedUsers, setSelectedUsers] = useState([]);
//   const [addingMembers, setAddingMembers] = useState(false);
//   const [channelMembers, setChannelMembers] = useState([]);
//   const [loadingMembers, setLoadingMembers] = useState(false);
//   const [expandedMember, setExpandedMember] = useState(null);
//   const [isEditingName, setIsEditingName] = useState(false);
//   const [editedChannelName, setEditedChannelName] = useState("");
//   const [savingChannelName, setSavingChannelName] = useState(false);
//   const [userRole, setUserRole] = useState(null);

//   const { socket, user } = useAuthContext();
//   const token = localStorage.getItem("token");
//   const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

//   useEffect(() => {
//     if (show && channel?._id) {
//       fetchChannelMembers();
//       setEditedChannelName(channel?.name || "");
//     }
//   }, [show, channel]);

//   useEffect(() => {
//     if (show && channel?._id && roleUpdateTrigger > 0) fetchChannelMembers();
//   }, [roleUpdateTrigger]);

//   useEffect(() => {
//     if (!socket || !show) return;

//     const handleRoleChange = (data) => {
//       console.log({ data });

//       // Fix: Use channelId instead of channel_id
//       const eventChannelId = data.channelId || data.channel_id;

//       if (eventChannelId === channel?._id) {
//         setChannelMembers((prevMembers) =>
//           prevMembers.map((member) => {
//             const memberUserId = member.user_id?._id || member.user_id;
//             const eventUserId =
//               data.member?.user_id?._id || data.member?.user_id || data.user_id;

//             if (memberUserId === eventUserId) {
//               const newRole = data.member?.role || data.role;

//               // Update current user's role if it's their role that changed
//               if (memberUserId === user?.id?.toString()) {
//                 setUserRole(newRole);
//               }

//               return {
//                 ...member,
//                 role: newRole,
//                 updatedAt: new Date().toISOString(),
//               };
//             }
//             return member;
//           })
//         );
//         setExpandedMember(null);
//       }
//     };

//     const handleMemberAdded = (data) => {
//       const eventChannelId = data.channelId || data.channel_id;
//       if (eventChannelId === channel?._id) {
//         fetchChannelMembers();
//       }
//     };

//     const handleMemberRemoved = (data) => {
//       const eventChannelId = data.channelId || data.channel_id;
//       if (eventChannelId === channel?._id) {
//         const eventUserId =
//           data.member?.user_id?._id || data.member?.user_id || data.user_id;
//         setChannelMembers((prev) =>
//           prev.filter((m) => (m.user_id?._id || m.user_id) !== eventUserId)
//         );
//       }
//     };

//     const handleChannelNameUpdate = (data) => {
//       const eventChannelId = data.channelId || data.channel_id;
//       if (eventChannelId === channel?._id) {
//         setEditedChannelName(data.new_name);
//         setIsEditingName(false);
//       }
//     };

//     socket.on("changesRole", handleRoleChange);
//     socket.on("roleChanged", handleRoleChange);
//     socket.on("role-changed", handleRoleChange);
//     socket.on("updateRole", handleRoleChange);
//     socket.on("memberRoleUpdated", handleRoleChange);
//     socket.on("memberAdded", handleMemberAdded);
//     socket.on("member-added", handleMemberAdded);
//     socket.on("addMember", handleMemberAdded);
//     socket.on("memberRemoved", handleMemberRemoved);
//     socket.on("member-removed", handleMemberRemoved);
//     socket.on("removeMember", handleMemberRemoved);
//     socket.on("channel_name_changed", handleChannelNameUpdate);

//     return () => {
//       socket.off("changesRole", handleRoleChange);
//       socket.off("roleChanged", handleRoleChange);
//       socket.off("role-changed", handleRoleChange);
//       socket.off("updateRole", handleRoleChange);
//       socket.off("memberRoleUpdated", handleRoleChange);
//       socket.off("memberAdded", handleMemberAdded);
//       socket.off("member-added", handleMemberAdded);
//       socket.off("addMember", handleMemberAdded);
//       socket.off("memberRemoved", handleMemberRemoved);
//       socket.off("member-removed", handleMemberRemoved);
//       socket.off("removeMember", handleMemberRemoved);
//       socket.off("channel_name_changed", handleChannelNameUpdate);
//     };
//   }, [socket, show, channel?._id, user?.id]);
//   const fetchChannelMembers = async () => {
//     if (!channel?._id) return;
//     setLoadingMembers(true);
//     try {
//       const currentUserMember = channel.members?.find(
//         (m) => (m.user_id?._id || m.user_id) === user?.id?.toString()
//       );
//       if (currentUserMember) setUserRole(currentUserMember.role);
//       setChannelMembers(channel.members || []);
//     } catch (error) {
//       console.error("Error fetching channel members:", error);
//     } finally {
//       setLoadingMembers(false);
//     }
//   };

//   const handleSearchInput = (e) => {
//     const query = e.target.value;
//     setSearchQuery(query);
//     handleSearch(query);
//   };
//   const toggleUserSelection = (user) => {
//     setSelectedUsers((prev) =>
//       prev.some((u) => u._id === user._id)
//         ? prev.filter((u) => u._id !== user._id)
//         : [...prev, user]
//     );
//   };

//   const handleAddMembers = async () => {
//     if (selectedUsers.length === 0) return;
//     setAddingMembers(true);
//     try {
//       await onAddMembers(
//         channel._id,
//         selectedUsers.map((u) => u._id)
//       );
//       setSelectedUsers([]);
//       setSearchQuery("");
//       setActiveTab("members");
//       await fetchChannelMembers();
//     } catch (error) {
//       console.error("Error adding members:", error);
//     } finally {
//       setAddingMembers(false);
//     }
//   };

//   const handleRoleChange = async (memberId, newRole) => {
//     try {
//       await onUpdateRole(channel._id, memberId, newRole);
//       setTimeout(fetchChannelMembers, 2000);
//     } catch (error) {
//       toast.error("Failed to update role");
//       fetchChannelMembers();
//     }
//   };

//   const handleRemoveMember = async (memberId) => {
//     if (!window.confirm("Are you sure you want to remove this member?")) return;
//     try {
//       await onRemoveMember(channel._id, memberId);
//       setTimeout(fetchChannelMembers, 2000);
//     } catch (error) {
//       toast.error("Failed to remove member");
//       fetchChannelMembers();
//     }
//   };

//   const handleSaveChannelName = async () => {
//     if (!editedChannelName.trim()) {
//       toast.error("Channel name cannot be empty");
//       return;
//     }
//     if (editedChannelName.trim() === channel?.name) {
//       setIsEditingName(false);
//       return;
//     }
//     setSavingChannelName(true);
//     try {
//       const response = await axios.post(
//         `${BACKEND_URL}/chat/channels/${channel._id}/name`,
//         { name: editedChannelName.trim() },
//         axiosConfig
//       );
//       if (response.data.success) {
//         setIsEditingName(false);
//         if (channel) channel.name = editedChannelName.trim();
//       }
//       onClose();
//     } catch (error) {
//       toast.error(
//         error.response?.data?.error || "Failed to update channel name"
//       );
//       setEditedChannelName(channel?.name || "");
//     } finally {
//       setSavingChannelName(false);
//     }
//   };

//   const isAdmin = userRole === "admin";
//   if (!show) return null;

//   return (
//     <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
//       <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
//         {/* Header */}
//         <div className="px-5 py-4 border-b border-zinc-700/30">
//           <div className="flex items-center justify-between mb-3">
//             <div>
//               <h2 className="text-base font-semibold text-white">
//                 Channel Settings
//               </h2>
//               <div className="flex items-center gap-2 mt-1">
//                 {isEditingName ? (
//                   <div className="flex items-center gap-1.5">
//                     <input
//                       type="text"
//                       value={editedChannelName}
//                       onChange={(e) => setEditedChannelName(e.target.value)}
//                       className="px-2 py-1 border border-zinc-600 rounded text-sm bg-zinc-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
//                       autoFocus
//                       onKeyDown={(e) => {
//                         if (e.key === "Enter") handleSaveChannelName();
//                         if (e.key === "Escape") {
//                           setEditedChannelName(channel?.name || "");
//                           setIsEditingName(false);
//                         }
//                       }}
//                     />
//                     <button
//                       onClick={handleSaveChannelName}
//                       disabled={savingChannelName}
//                       className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition disabled:opacity-50"
//                     >
//                       {savingChannelName ? (
//                         <Loader2 className="w-3.5 h-3.5 animate-spin" />
//                       ) : (
//                         <Check className="w-3.5 h-3.5" />
//                       )}
//                     </button>
//                     <button
//                       onClick={() => {
//                         setEditedChannelName(channel?.name || "");
//                         setIsEditingName(false);
//                       }}
//                       className="p-1 text-zinc-400 hover:bg-zinc-800 rounded transition"
//                     >
//                       <X className="w-3.5 h-3.5" />
//                     </button>
//                   </div>
//                 ) : (
//                   <div className="flex items-center gap-1.5">
//                     <p className="text-sm text-zinc-400">
//                       {editedChannelName || channel?.name}
//                     </p>
//                     {isAdmin && (
//                       <button
//                         onClick={() => setIsEditingName(true)}
//                         className="p-1 text-zinc-500 hover:bg-zinc-800 rounded transition"
//                       >
//                         <Edit2 className="w-3 h-3" />
//                       </button>
//                     )}
//                   </div>
//                 )}
//               </div>
//               {isAdmin && !isEditingName && (
//                 <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded font-medium">
//                   <Crown className="w-2.5 h-2.5" /> Admin
//                 </span>
//               )}
//             </div>
//             <button
//               onClick={onClose}
//               className="p-1 text-zinc-400 hover:bg-zinc-800 rounded-lg transition"
//             >
//               <X className="w-4 h-4" />
//             </button>
//           </div>

//           {/* Tabs */}
//           <div className="flex gap-1 p-0.5 bg-zinc-800 rounded-lg">
//             <button
//               onClick={() => setActiveTab("members")}
//               className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
//                 activeTab === "members"
//                   ? "bg-zinc-700 text-white shadow-sm"
//                   : "text-zinc-400 hover:text-zinc-300"
//               }`}
//             >
//               Members ({channelMembers.length})
//             </button>
//             <button
//               onClick={() => setActiveTab("add")}
//               className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center justify-center gap-1 ${
//                 activeTab === "add"
//                   ? "bg-zinc-700 text-white shadow-sm"
//                   : "text-zinc-400 hover:text-zinc-300"
//               }`}
//             >
//               <UserPlus className="w-3 h-3" /> Add Members
//             </button>
//           </div>
//         </div>

//         {/* Content */}
//         <div className="flex-1 overflow-y-auto p-3">
//           {activeTab === "members" ? (
//             <div className="space-y-1">
//               {loadingMembers ? (
//                 <div className="flex justify-center py-10">
//                   <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
//                 </div>
//               ) : channelMembers.length === 0 ? (
//                 <div className="text-center py-10">
//                   <User className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
//                   <p className="text-sm text-zinc-400">No members</p>
//                 </div>
//               ) : (
//                 channelMembers.map((member) => (
//                   <div
//                     key={member._id || member.user_id?._id}
//                     className="border border-zinc-700/30 rounded-lg overflow-hidden hover:border-zinc-600 transition"
//                   >
//                     <div className="flex items-center justify-between p-3">
//                       <div className="flex items-center gap-2.5">
//                         <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center">
//                           <span className="text-indigo-400 font-medium text-xs">
//                             {member.user_id?.first_name?.[0]}
//                             {member.user_id?.last_name?.[0]}
//                           </span>
//                         </div>
//                         <div>
//                           <p className="text-sm font-medium text-white">
//                             {member.user_id?.first_name}{" "}
//                             {member.user_id?.last_name}
//                           </p>
//                           <p className="text-xs text-zinc-500">
//                             {member.user_id?.email}
//                           </p>
//                         </div>
//                       </div>
//                       <div className="flex items-center gap-1.5">
//                         <span
//                           className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${
//                             member.role === "admin"
//                               ? "bg-amber-500/10 text-amber-400"
//                               : "bg-zinc-800 text-zinc-400"
//                           }`}
//                         >
//                           {member.role === "admin" ? (
//                             <Crown className="w-2.5 h-2.5" />
//                           ) : (
//                             <User className="w-2.5 h-2.5" />
//                           )}
//                           {member.role}
//                         </span>
//                         {isAdmin && (
//                           <button
//                             onClick={() =>
//                               setExpandedMember(
//                                 expandedMember === member._id
//                                   ? null
//                                   : member._id
//                               )
//                             }
//                             className="p-1 text-zinc-500 hover:bg-zinc-800 rounded transition"
//                           >
//                             <ChevronDown
//                               className={`w-3.5 h-3.5 transition-transform ${
//                                 expandedMember === member._id
//                                   ? "rotate-180"
//                                   : ""
//                               }`}
//                             />
//                           </button>
//                         )}
//                       </div>
//                     </div>
//                     {isAdmin && expandedMember === member._id && (
//                       <div className="border-t border-zinc-700/30 p-3 bg-zinc-800/50">
//                         <p className="text-xs font-medium text-zinc-400 mb-2">
//                           Change Role
//                         </p>
//                         <div className="flex gap-1.5 mb-3">
//                           {["member", "admin"].map((role) => (
//                             <button
//                               key={role}
//                               onClick={() =>
//                                 handleRoleChange(member.user_id?._id, role)
//                               }
//                               disabled={member.role === role}
//                               className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
//                                 member.role === role
//                                   ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
//                                   : "bg-zinc-900 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800"
//                               }`}
//                             >
//                               {role}
//                             </button>
//                           ))}
//                         </div>
//                         <button
//                           onClick={() =>
//                             handleRemoveMember(member.user_id?._id)
//                           }
//                           className="w-full px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition flex items-center justify-center gap-1"
//                         >
//                           <Trash2 className="w-3 h-3" /> Remove
//                         </button>
//                       </div>
//                     )}
//                   </div>
//                 ))
//               )}
//             </div>
//           ) : (
//             <div className="space-y-3">
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-500" />
//                 <input
//                   value={searchQuery}
//                   onChange={handleSearchInput}
//                   placeholder="Search users..."
//                   className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-500"
//                   autoFocus
//                 />
//               </div>
//               {selectedUsers.length > 0 && (
//                 <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
//                   <p className="text-xs font-medium text-indigo-400 mb-1.5">
//                     Selected ({selectedUsers.length})
//                   </p>
//                   <div className="flex flex-wrap gap-1">
//                     {selectedUsers.map((user) => (
//                       <span
//                         key={user._id}
//                         className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-indigo-500/30 rounded-md text-xs text-indigo-300"
//                       >
//                         {user.first_name} {user.last_name}
//                         <button
//                           onClick={() => toggleUserSelection(user)}
//                           className="text-indigo-500 hover:text-indigo-300"
//                         >
//                           <X className="w-3 h-3" />
//                         </button>
//                       </span>
//                     ))}
//                   </div>
//                 </div>
//               )}
//               <div className="space-y-1">
//                 {isSearching ? (
//                   <div className="flex justify-center py-10">
//                     <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
//                   </div>
//                 ) : searchQuery && searchResults.length === 0 ? (
//                   <div className="text-center py-10">
//                     <p className="text-sm text-zinc-400">No users found</p>
//                   </div>
//                 ) : !searchQuery ? (
//                   <div className="text-center py-10">
//                     <Search className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
//                     <p className="text-sm text-zinc-400">
//                       Search for users to add
//                     </p>
//                   </div>
//                 ) : (
//                   searchResults.map((user) => {
//                     const isSelected = selectedUsers.some(
//                       (u) => u._id === user._id
//                     );
//                     const isAlreadyMember = channelMembers.some(
//                       (m) => m.user_id?._id === user._id
//                     );
//                     return (
//                       <div
//                         key={user._id}
//                         className={`flex items-center justify-between p-3 rounded-lg transition ${
//                           isAlreadyMember
//                             ? "bg-zinc-800/30 opacity-50"
//                             : isSelected
//                             ? "bg-indigo-500/10"
//                             : "hover:bg-zinc-800/50"
//                         }`}
//                       >
//                         <div className="flex items-center gap-2.5">
//                           <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center">
//                             <span className="text-indigo-400 font-medium text-xs">
//                               {user.first_name?.[0]}
//                               {user.last_name?.[0]}
//                             </span>
//                           </div>
//                           <div>
//                             <p className="text-sm font-medium text-white">
//                               {user.first_name} {user.last_name}
//                             </p>
//                             <p className="text-xs text-zinc-500">
//                               {user.email}
//                             </p>
//                           </div>
//                         </div>
//                         {isAlreadyMember ? (
//                           <span className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded text-xs">
//                             Member
//                           </span>
//                         ) : (
//                           <button
//                             onClick={() => toggleUserSelection(user)}
//                             className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
//                               isSelected
//                                 ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
//                                 : "bg-indigo-600 text-white hover:bg-indigo-500"
//                             }`}
//                           >
//                             {isSelected ? "Remove" : "Select"}
//                           </button>
//                         )}
//                       </div>
//                     );
//                   })
//                 )}
//               </div>
//             </div>
//           )}
//         </div>

//         {activeTab === "add" && selectedUsers.length > 0 && (
//           <div className="px-5 py-3 border-t border-zinc-700/30">
//             <button
//               onClick={handleAddMembers}
//               disabled={addingMembers}
//               className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
//             >
//               {addingMembers ? (
//                 <>
//                   <Loader2 className="w-4 h-4 animate-spin" /> Adding...
//                 </>
//               ) : (
//                 <>
//                   <UserPlus className="w-4 h-4" /> Add {selectedUsers.length}{" "}
//                   Member{selectedUsers.length !== 1 ? "s" : ""}
//                 </>
//               )}
//             </button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ChannelSettingsModal;
import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  UserPlus,
  Loader2,
  Shield,
  User,
  Crown,
  Trash2,
  ChevronDown,
  Edit2,
  Check,
} from "lucide-react";
import { useAuthContext } from "../context/AuthContextProvider";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "@/config";

const ChannelSettingsModal = ({
  show,
  onClose,
  channel,
  onAddMembers,
  onUpdateRole,
  onRemoveMember,
  handleSearch,
  searchResults,
  isSearching,
  roleUpdateTrigger,
}) => {
  const [activeTab, setActiveTab] = useState("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [channelMembers, setChannelMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedChannelName, setEditedChannelName] = useState("");
  const [savingChannelName, setSavingChannelName] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const { socket, user } = useAuthContext();
  const token = localStorage.getItem("token");
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (show && channel?._id) {
      fetchChannelMembers();
      setEditedChannelName(channel?.name || "");
    }
  }, [show, channel]);

  useEffect(() => {
    if (!socket || !show) return;

    const handleRoleChange = (data) => {
      console.log("Socket role change received:", data);
      const eventChannelId = data.channelId || data.channel_id;

      if (eventChannelId === channel?._id) {
        setChannelMembers((prevMembers) =>
          prevMembers.map((member) => {
            const memberUserId = member.user_id?._id || member.user_id;
            const eventUserId =
              data.member?.user_id?._id || data.member?.user_id || data.user_id;

            if (memberUserId === eventUserId) {
              const newRole = data.member?.role || data.role;

              // Update current user's role if it's their role that changed
              if (memberUserId === user?.id?.toString()) {
                setUserRole(newRole);
              }

              return {
                ...member,
                role: newRole,
                updatedAt: new Date().toISOString(),
              };
            }
            return member;
          })
        );
        setExpandedMember(null);
      }
    };

    const handleMemberAdded = (data) => {
      const eventChannelId = data.channelId || data.channel_id;
      if (eventChannelId === channel?._id) {
        fetchChannelMembers();
      }
    };

    const handleMemberRemoved = (data) => {
      const eventChannelId = data.channelId || data.channel_id;
      if (eventChannelId === channel?._id) {
        const eventUserId =
          data.removedUserId ||
          data.member?.user_id?._id ||
          data.member?.user_id ||
          data.user_id;

        setChannelMembers((prev) =>
          prev.filter(
            (m) =>
              (m.user_id?._id || m.user_id)?.toString() !==
              eventUserId?.toString()
          )
        );
      }
    };

    const handleChannelNameUpdate = (data) => {
      const eventChannelId = data.channelId || data.channel_id;
      if (eventChannelId === channel?._id) {
        setEditedChannelName(data.new_name);
        setIsEditingName(false);
      }
    };

    socket.on("changesRole", handleRoleChange);
    socket.on("roleChanged", handleRoleChange);
    socket.on("role-changed", handleRoleChange);
    socket.on("updateRole", handleRoleChange);
    socket.on("memberRoleUpdated", handleRoleChange);
    socket.on("memberAdded", handleMemberAdded);
    socket.on("member-added", handleMemberAdded);
    socket.on("addMember", handleMemberAdded);
    socket.on("memberRemoved", handleMemberRemoved);
    socket.on("member-removed", handleMemberRemoved);
    socket.on("removeMember", handleMemberRemoved);
    socket.on("channel_name_changed", handleChannelNameUpdate);

    return () => {
      socket.off("changesRole", handleRoleChange);
      socket.off("roleChanged", handleRoleChange);
      socket.off("role-changed", handleRoleChange);
      socket.off("updateRole", handleRoleChange);
      socket.off("memberRoleUpdated", handleRoleChange);
      socket.off("memberAdded", handleMemberAdded);
      socket.off("member-added", handleMemberAdded);
      socket.off("addMember", handleMemberAdded);
      socket.off("memberRemoved", handleMemberRemoved);
      socket.off("member-removed", handleMemberRemoved);
      socket.off("removeMember", handleMemberRemoved);
      socket.off("channel_name_changed", handleChannelNameUpdate);
    };
  }, [socket, show, channel?._id, user?.id]);

  const fetchChannelMembers = async () => {
    if (!channel?._id) return;
    setLoadingMembers(true);
    try {
      const currentUserMember = channel.members?.find(
        (m) => (m.user_id?._id || m.user_id) === user?.id?.toString()
      );
      if (currentUserMember) setUserRole(currentUserMember.role);
      setChannelMembers(channel.members || []);
    } catch (error) {
      console.error("Error fetching channel members:", error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    handleSearch(query);
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user]
    );
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    setAddingMembers(true);
    try {
      await onAddMembers(
        channel._id,
        selectedUsers.map((u) => u._id)
      );
      setSelectedUsers([]);
      setSearchQuery("");
      setActiveTab("members");
      await fetchChannelMembers();
    } catch (error) {
      console.error("Error adding members:", error);
    } finally {
      setAddingMembers(false);
    }
  };

  // OPTIMISTIC UI UPDATE: Update role immediately in UI, then call API
  const handleRoleChange = async (memberId, newRole) => {
    // Optimistically update the UI immediately
    setChannelMembers((prevMembers) =>
      prevMembers.map((member) => {
        const memberUserId = member.user_id?._id || member.user_id;
        if (memberUserId === memberId) {
          // Update current user's role if it's their role being changed
          if (memberUserId === user?.id?.toString()) {
            setUserRole(newRole);
          }
          return {
            ...member,
            role: newRole,
            updatedAt: new Date().toISOString(),
          };
        }
        return member;
      })
    );

    // Close the dropdown
    setExpandedMember(null);

    // Call the API
    try {
      await onUpdateRole(channel._id, memberId, newRole);
      // Success - UI is already updated
    } catch (error) {
      // Rollback on error
      toast.error("Failed to update role");
      await fetchChannelMembers(); // Refetch to restore correct state
    }
  };

  // OPTIMISTIC UI UPDATE: Remove member immediately from UI, then call API
  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;

    // Store the current members in case we need to rollback
    const previousMembers = [...channelMembers];

    // Optimistically remove from UI immediately
    setChannelMembers((prev) =>
      prev.filter((m) => (m.user_id?._id || m.user_id) !== memberId)
    );

    // Close the dropdown
    setExpandedMember(null);

    // Call the API
    try {
      await onRemoveMember(channel._id, memberId);
      // Success - UI is already updated
    } catch (error) {
      // Rollback on error
      toast.error("Failed to remove member");
      setChannelMembers(previousMembers); // Restore previous state
    }
  };

  const handleSaveChannelName = async () => {
    if (!editedChannelName.trim()) {
      toast.error("Channel name cannot be empty");
      return;
    }
    if (editedChannelName.trim() === channel?.name) {
      setIsEditingName(false);
      return;
    }
    setSavingChannelName(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/chat/channels/${channel._id}/name`,
        { name: editedChannelName.trim() },
        axiosConfig
      );
      if (response.data.success) {
        setIsEditingName(false);
        if (channel) channel.name = editedChannelName.trim();
      }
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to update channel name"
      );
      setEditedChannelName(channel?.name || "");
    } finally {
      setSavingChannelName(false);
    }
  };

  const isAdmin = userRole === "admin";

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-zinc-700/50">
        {/* Header */}
        <div className="p-5 border-b border-zinc-700/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">
              Channel Settings
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:bg-zinc-800 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedChannelName}
                onChange={(e) => setEditedChannelName(e.target.value)}
                className="px-2 py-1 border border-zinc-600 rounded text-sm bg-zinc-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveChannelName();
                  if (e.key === "Escape") {
                    setEditedChannelName(channel?.name || "");
                    setIsEditingName(false);
                  }
                }}
              />
              <button
                onClick={handleSaveChannelName}
                disabled={savingChannelName}
                className="p-1 text-green-500 hover:bg-zinc-800 rounded transition disabled:opacity-50"
              >
                {savingChannelName ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
              </button>
              <button
                onClick={() => {
                  setEditedChannelName(channel?.name || "");
                  setIsEditingName(false);
                }}
                className="p-1 text-zinc-400 hover:bg-zinc-800 rounded transition"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-sm text-zinc-300 flex-1">
                {editedChannelName || channel?.name}
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-zinc-500 hover:bg-zinc-800 rounded transition"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>
          )}

          {isAdmin && !isEditingName && (
            <span className="inline-block mt-2 text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 flex gap-2 border-b border-zinc-700/50">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === "members"
                ? "bg-zinc-700 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            Members ({channelMembers.length})
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center justify-center gap-1 ${
              activeTab === "add"
                ? "bg-zinc-700 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            <UserPlus size={14} />
            Add Members
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "members" ? (
            <div className="space-y-2">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
              ) : channelMembers.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-sm">
                  No members
                </div>
              ) : (
                channelMembers.map((member) => (
                  <div
                    key={member.user_id?._id || member._id}
                    className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                        {member.user_id?.first_name?.[0]}
                        {member.user_id?.last_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {member.user_id?.first_name}{" "}
                          {member.user_id?.last_name}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          {member.user_id?.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                            member.role === "admin"
                              ? "bg-indigo-500/10 text-indigo-400"
                              : "bg-zinc-700/50 text-zinc-300"
                          }`}
                        >
                          {member.role === "admin" ? (
                            <Crown size={12} />
                          ) : (
                            <User size={12} />
                          )}
                          {member.role}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() =>
                              setExpandedMember(
                                expandedMember === member._id
                                  ? null
                                  : member._id
                              )
                            }
                            className="p-1 text-zinc-500 hover:bg-zinc-800 rounded transition"
                          >
                            <ChevronDown
                              size={16}
                              className={`transition-transform ${
                                expandedMember === member._id
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    {isAdmin && expandedMember === member._id && (
                      <div className="mt-3 pt-3 border-t border-zinc-700/50 space-y-2">
                        <div className="text-xs font-medium text-zinc-400 mb-2">
                          Change Role
                        </div>
                        <div className="flex gap-2">
                          {["member", "admin"].map((role) => (
                            <button
                              key={role}
                              onClick={() =>
                                handleRoleChange(member.user_id?._id, role)
                              }
                              disabled={member.role === role}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                                member.role === role
                                  ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                                  : "bg-zinc-900 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() =>
                            handleRemoveMember(member.user_id?._id)
                          }
                          className="w-full px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition flex items-center justify-center gap-1"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400"
                  size={16}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchInput}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {selectedUsers.length > 0 && (
                <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                  <div className="text-xs font-medium text-zinc-400 mb-2">
                    Selected ({selectedUsers.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-2 py-1"
                      >
                        <span className="text-xs text-indigo-300">
                          {user.first_name} {user.last_name}
                        </span>
                        <button
                          onClick={() => toggleUserSelection(user)}
                          className="text-indigo-500 hover:text-indigo-300"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2
                      className="animate-spin text-indigo-500"
                      size={32}
                    />
                  </div>
                ) : searchQuery && searchResults.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">
                    No users found
                  </div>
                ) : !searchQuery ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">
                    Search for users to add
                  </div>
                ) : (
                  searchResults.map((user) => {
                    const isSelected = selectedUsers.some(
                      (u) => u._id === user._id
                    );
                    const isAlreadyMember = channelMembers.some(
                      (m) => m.user_id?._id === user._id
                    );

                    return (
                      <div
                        key={user._id}
                        className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {user.first_name?.[0]}
                          {user.last_name?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-xs text-zinc-400 truncate">
                            {user.email}
                          </div>
                        </div>
                        {isAlreadyMember ? (
                          <span className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-700/50 rounded-lg">
                            Member
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleUserSelection(user)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              isSelected
                                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                : "bg-indigo-600 text-white hover:bg-indigo-500"
                            }`}
                          >
                            {isSelected ? "Remove" : "Select"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {activeTab === "add" && selectedUsers.length > 0 && (
          <div className="p-5 border-t border-zinc-700/50">
            <button
              onClick={handleAddMembers}
              disabled={addingMembers}
              className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {addingMembers ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Add {selectedUsers.length} Member
                  {selectedUsers.length !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
