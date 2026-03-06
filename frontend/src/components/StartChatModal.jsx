import { Search, X, Loader2 } from "lucide-react";

const StartChatModal = ({
  show,
  onClose,
  searchQuery,
  handleSearchInput,
  searchResults,
  isSearching,
  startChat,
  loading,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-700/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">New Chat</h2>
            <button onClick={onClose} className="p-1 text-zinc-400 hover:bg-zinc-800 rounded-lg transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-500"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isSearching ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
            </div>
          ) : searchQuery && searchResults.length === 0 ? (
            <div className="text-center py-10">
              <Search className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">No users found</p>
            </div>
          ) : !searchQuery ? (
            <div className="text-center py-10">
              <Search className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">Search for users to chat with</p>
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((user) => (
                <div key={user._id} className="flex items-center justify-between p-3 hover:bg-zinc-800/50 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center overflow-hidden">
                      {user.profile_picture ? (
                        <img src={user.profile_picture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-indigo-400 font-medium text-xs">{user.first_name?.[0]}{user.last_name?.[0]}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{user.full_name}</p>
                      <p className="text-xs text-zinc-500">{user.email}</p>
                      {user.employee_info && (
                        <p className="text-[10px] text-zinc-600">{user.employee_info.department?.name || "—"} &middot; {user.employee_info.position}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => startChat(user)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500 disabled:opacity-50 transition"
                  >
                    {user.has_existing_chat ? "Open" : "Chat"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StartChatModal;
