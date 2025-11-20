import { useEffect, useRef, useState } from "react";
import socket from "../socket";
import { Send, X, Users } from "lucide-react";

const formatTime = (ts) => {
  if (!ts) return "";
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function ChatBox({ roomId, playerName, messages, setMessages, closeChat }) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = newMessage.trim();
    if (!text) return;
    setSending(true);
    const msgObj = { playerName, message: text, ts: Date.now() };
    socket.emit("send_message", { roomId, playerName, message: text });
    setMessages((prev) => [...prev, msgObj]);
    setNewMessage("");
    setTimeout(() => setSending(false), 180);
  };

  return (
    <div className="w-80 h-96 bg-gradient-to-b from-[#071029] to-[#0b1220] text-gray-100 rounded-2xl flex flex-col shadow-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#071f3f]/60 to-[#09233f]/40 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#073763] to-[#0b5a8a] flex items-center justify-center text-white shadow-sm">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Live Chat</h2>
            <p className="text-[11px] text-gray-400">Room · <span className="text-white">{playerName}</span></p>
          </div>
        </div>

        {/* ✅ Only one close button */}
        {closeChat && (
          <button
            onClick={closeChat}
            className="p-1 rounded-md hover:bg-red-500/10 transition"
            title="Close chat"
            aria-label="Close chat"
          >
            <X className="w-4 h-4 text-gray-300 hover:text-red-400" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {messages?.length === 0 && (
          <div className="text-center text-xs text-gray-400 mt-8">No messages yet — say hi 👋</div>
        )}
        {messages?.map((msg, i) => {
          const isMe = msg.playerName === playerName;
          const initials = msg.playerName?.[0]?.toUpperCase() || "?";
          return (
            <div
              key={i}
              className={`flex items-end ${isMe ? "justify-end" : "justify-start"}`}
            >
              {!isMe && (
                <div className="w-8 h-8 mr-2 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {initials}
                </div>
              )}
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words leading-snug ${
                  isMe
                    ? "bg-gradient-to-br from-[#0ea5a4] to-[#06b6d4] text-black rounded-br-none"
                    : "bg-[#0f1724] text-gray-100 rounded-bl-none border border-gray-800"
                }`}
              >
                {!isMe && (
                  <div className="text-[10px] text-gray-400 mb-1 font-medium">{msg.playerName}</div>
                )}
                <p>{msg.message}</p>
                <div className="text-[10px] text-gray-500 mt-1 text-right">{formatTime(msg.ts)}</div>
              </div>
              {isMe && (
                <div className="w-8 h-8 ml-2 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {initials}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-gradient-to-t from-[#081124]/60 to-transparent border-t border-gray-800 flex items-center gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-[#071020] placeholder-gray-500 text-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06b6d4]/30"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !newMessage.trim()}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition ${
            sending || !newMessage.trim()
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-[#06b6d4] hover:brightness-110 text-white shadow-md"
          }`}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
