import { useState, useEffect } from "react";
import { X, Send } from "lucide-react";

/**
 * ReplyModal Component
 * Shows inline reply dialog for chat notifications
 * User can type and send message directly to chat
 */
export const ReplyModal = ({ notification, onSend, onClose }) => {
  const [replyText, setReplyText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;

    setIsLoading(true);
    try {
      // Call the onSend callback
      await onSend(replyText);

      // Close modal
      onClose();
    } catch (error) {
      console.error("[REPLY_MODAL] Error sending reply:", error);
      alert("Failed to send reply. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSendReply();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">
              Reply to {notification?.sender_name || "User"}
            </h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              "{notification?.body || notification?.title || ''}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message Input */}
        <div className="p-4">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your reply... (Ctrl+Enter to send)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={4}
            autoFocus
            disabled={isLoading}
          />
        </div>

        {/* Footer with Send Button */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSendReply}
            disabled={isLoading || !replyText.trim()}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={16} />
            {isLoading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplyModal;
