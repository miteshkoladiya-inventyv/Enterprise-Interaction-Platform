import React, { useState } from "react";
import { Search, X, Loader2, UserPlus } from "lucide-react";

const AddMembersModal = ({
  show,
  onClose,
  searchQuery,
  handleSearchInput,
  searchResults,
  isSearching,
  addMembers,
  existingMembers,
}) => {
  const [selectedUsers, setSelectedUsers] = useState([]);

  if (!show) return null;

  const handleClose = () => { setSelectedUsers([]); onClose(); };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    await addMembers(selectedUsers.map((u) => u._id));
    setSelectedUsers([]);
  };

  const isExistingMember = (userId) => existingMembers.some((m) => m.user_id._id === userId);
  const isSelected = (userId) => selectedUsers.some((u) => u._id === userId);
  const toggleUser = (user) => {
    if (isSelected(user._id)) setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    else setSelectedUsers([...selectedUsers, user]);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-700/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Add Members</h2>
            <button onClick={handleClose} className="p-1 text-zinc-400 hover:bg-zinc-800 rounded-lg transition"><X className="w-4 h-4" /></button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-500" />
            <input value={searchQuery} onChange={handleSearchInput} placeholder="Search users to add..." className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-500" />
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedUsers.map((u) => (
                <span key={u._id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md text-xs font-medium">
                  {u.first_name} {u.last_name}
                  <button onClick={() => toggleUser(u)} className="text-indigo-500 hover:text-indigo-300"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isSearching ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-10">
              <Search className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">{searchQuery ? "No users found" : "Search for users"}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((user) => {
                const alreadyMember = isExistingMember(user._id);
                const selected = isSelected(user._id);
                return (
                  <div key={user._id} className={`flex items-center justify-between p-3 rounded-lg transition ${alreadyMember ? "bg-zinc-800/30 opacity-50" : selected ? "bg-indigo-500/10" : "hover:bg-zinc-800/50"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center"><span className="text-indigo-400 font-medium text-xs">{user.first_name?.[0]}{user.last_name?.[0]}</span></div>
                      <div><p className="text-sm font-medium text-white">{user.first_name} {user.last_name}</p><p className="text-xs text-zinc-500">{user.email}</p></div>
                    </div>
                    {alreadyMember ? (
                      <span className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded text-xs">Member</span>
                    ) : (
                      <button onClick={() => toggleUser(user)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selected ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}>
                        {selected ? "Remove" : "Add"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-700/30">
          <button disabled={selectedUsers.length === 0} onClick={handleAddMembers} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add {selectedUsers.length > 0 ? `${selectedUsers.length} ` : ""}Member{selectedUsers.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMembersModal;
