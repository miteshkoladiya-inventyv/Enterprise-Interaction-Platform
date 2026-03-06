import { Search, X, Loader2 } from "lucide-react";

const CreateGroupModal = ({
  show,
  onClose,
  groupName,
  setGroupName,
  department,
  setDepartment,
  searchQuery,
  handleSearchInput,
  searchResults,
  selectedUsers,
  setSelectedUsers,
  isSearching,
  createGroup,
  createGroupLoading,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-xl w-full max-w-lg max-h-[75vh] flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-700/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Create Group</h2>
            <button onClick={onClose} className="p-1 text-zinc-400 hover:bg-zinc-800 rounded-lg transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full px-3 py-2 border border-zinc-600 rounded-lg text-sm bg-zinc-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-500"
            />
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Department (optional)"
              className="w-full px-3 py-2 border border-zinc-600 rounded-lg text-sm bg-zinc-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-500"
            />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={searchQuery}
                onChange={handleSearchInput}
                placeholder="Search users to add..."
                className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-500"
              />
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedUsers.map((u) => (
                <span key={u._id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md text-xs font-medium">
                  {u.first_name}
                  <button onClick={() => setSelectedUsers((prev) => prev.filter((p) => p._id !== u._id))} className="text-indigo-500 hover:text-indigo-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isSearching ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((user) => {
                const isSelected = selectedUsers.some((u) => u._id === user._id);
                return (
                  <div key={user._id} className="flex items-center justify-between p-3 hover:bg-zinc-800/50 rounded-lg transition">
                    <div>
                      <p className="text-sm font-medium text-white">{user.full_name}</p>
                      <p className="text-xs text-zinc-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (isSelected) setSelectedUsers((prev) => prev.filter((u) => u._id !== user._id));
                        else setSelectedUsers((prev) => [...prev, user]);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        isSelected ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-indigo-600 text-white hover:bg-indigo-500"
                      }`}
                    >
                      {isSelected ? "Remove" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-700/30">
          <button
            onClick={createGroup}
            disabled={createGroupLoading || !groupName || selectedUsers.length < 2}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {createGroupLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
