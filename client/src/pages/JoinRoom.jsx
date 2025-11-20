/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Key, Users, Zap, ArrowRightCircle } from "lucide-react";
import socket from "../socket";
import Alert from "../components/Alert";

export default function JoinRoom() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [alertType, setAlertType] = useState("info");
  const [recentRooms, setRecentRooms] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    // socket listeners
    const onJoinError = ({ reason }) => {
      setJoining(false);
      setAlertType("error");
      setAlertMsg(reason || "Failed to join room");
      setTimeout(() => setAlertMsg(null), 3500);
    };

    const onRoomData = (room) => {
      if (!room) return;
      // if roomCode matches or if host returned confirmation
      setJoining(false);
      localStorage.setItem("playerName", name);
      setAlertType("success");
      setAlertMsg("Joined successfully. Redirecting...");
      setTimeout(() => navigate(`/room/${room.roomCode || roomCode}`), 800);
    };

    socket.on("join-error", onJoinError);
    socket.on("room-data", onRoomData);

    // small UX: load recent room codes from localStorage
    const recent = JSON.parse(localStorage.getItem("recentRooms")) || [];
    setRecentRooms(recent.slice(0, 5));

    return () => {
      socket.off("join-error", onJoinError);
      socket.off("room-data", onRoomData);
    };
  }, [name, roomCode, navigate]);

  const saveRecent = (code) => {
    try {
      const existing = JSON.parse(localStorage.getItem("recentRooms")) || [];
      const dedup = [code, ...existing.filter((c) => c !== code)].slice(0, 10);
      localStorage.setItem("recentRooms", JSON.stringify(dedup));
      setRecentRooms(dedup.slice(0, 5));
    } catch (e) {
      // ignore
    }
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) {
      setAlertType("warning");
      setAlertMsg("Please enter both team name and room code.");
      setTimeout(() => setAlertMsg(null), 3000);
      return;
    }

    if (joining) return;
    setJoining(true);

    // optimistic save for UX
    saveRecent(roomCode.trim());

    socket.emit("join-room", { roomCode: roomCode.trim(), name: name.trim() });

    // fallback if server doesn't respond
    const fallback = setTimeout(() => {
      if (joining) {
        setJoining(false);
        setAlertType("warning");
        setAlertMsg("No response from server — please check the code or try again.");
        setTimeout(() => setAlertMsg(null), 3000);
      }
    }, 5000);

    // clear fallback if join completes (onRoomData handles it)
    return () => clearTimeout(fallback);
  };

  const quickFill = (code) => {
    setRoomCode(code);
  };

  const handleQuickJoin = (code) => {
    setRoomCode(code);
    // slight delay to allow input to update visually, then join
    setTimeout(() => handleJoin(), 150);
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      {alertMsg && (
        <Alert type={alertType} message={alertMsg} duration={3000} onClose={() => setAlertMsg(null)} />
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.995 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* Left: Visual + Tips */}
        <div className="rounded-2xl p-6 bg-card border border-slate-700 backdrop-blur">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Join Auction Room</h3>
              <p className="text-sm text-slate-300">Enter your team name & room code to jump into a live auction.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-slate-700/40">
                <Users className="w-5 h-5 text-slate-200" />
              </div>
              <div>
                <p className="text-sm text-slate-300 font-medium">Real-time bidding</p>
                <p className="text-xs text-slate-400">Compete live with friends — highest bidder wins the player.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-slate-700/40">
                <Zap className="w-5 h-5 text-slate-200" />
              </div>
              <div>
                <p className="text-sm text-slate-300 font-medium">Fast timers & auto-extend</p>
                <p className="text-xs text-slate-400">Auctions auto-extend on last-second bids to keep things fair.</p>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-800/30 border border-slate-700 text-sm text-slate-300">
              <p className="font-medium">Tips to join quickly</p>
              <ul className="mt-2 list-disc list-inside text-xs text-slate-400 space-y-1">
                <li>Copy the 5-digit room code from the host.</li>
                <li>Use a unique team name so others can spot you in the lobby.</li>
                <li>If the room is full or inactive you'll receive an error message.</li>
              </ul>
            </div>

            {recentRooms.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-400">Recent codes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recentRooms.map((c) => (
                    <button
                      key={c}
                      onClick={() => quickFill(c)}
                      title={`Fill ${c}`}
                      className="px-3 py-1 rounded-md text-xs bg-slate-700/40 border border-slate-600"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Form */}
        <div className="rounded-2xl p-6 bg-card2 border border-slate-700 backdrop-blur flex flex-col justify-between">
          <div>
            <label className="text-xs text-slate-300 font-medium flex items-center gap-2">
              <User className="w-4 h-4" /> Team Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mumbai Tigers"
              className="input input-bordered w-full mt-2 bg-slate-900 text-white"
            />

            <label className="text-xs text-slate-300 font-medium flex items-center gap-2 mt-4">
              <Key className="w-4 h-4" /> Room Code
            </label>
            <div className="flex gap-2 mt-2">
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter 5-digit code"
                className="input input-bordered flex-1 bg-slate-900 text-white font-mono"
              />
              <button
                onClick={() => handleQuickJoin(roomCode.trim())}
                disabled={!roomCode.trim() || joining}
                className={`btn btn-primary flex items-center gap-2 ${joining ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <ArrowRightCircle className="w-4 h-4" />
                Quick Join
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-400">
              <strong>Note:</strong> If the host enabled a password or whitelist, you will
              be validated after sending the join request.
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleJoin}
              disabled={joining}
              className={`btn btn-wide btn-accent ${joining ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {joining ? "Joining..." : "Join Room"}
            </button>

            <div className="text-center text-xs text-slate-400">Trouble joining? Contact the host or try a different code.</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
