/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  UserPlus,
  Users,
  Calendar,
  DollarSign,
} from "lucide-react";
import socket from "../socket";
import axios from "axios";
import { API_BASE_URL } from "../config";
import Alert from "../components/Alert";

function generateRoomCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export default function CreateRoom() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [budget, setBudget] = useState(100);
  const [dataset, setDataset] = useState("ipl");
  const [totalPlayersPerTeam, setTotalPlayersPerTeam] = useState(11);
  const [maxForeignPlayers, setMaxForeignPlayers] = useState(4);
  const [copied, setCopied] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [alertType, setAlertType] = useState("info");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setRoomCode(generateRoomCode());
  }, []);

  const handleCopy = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setAlertType("error");
      setAlertMsg("Failed to copy. Please copy manually.");
      setTimeout(() => setAlertMsg(null), 3000);
    }
  };

  const validate = () => {
    if (!name.trim()) return "Please enter your team name.";
    if (!maxPlayers || Number(maxPlayers) < 2)
      return "Select at least 2 teams.";
    if (!budget || Number(budget) <= 0) return "Budget must be greater than 0.";
    if (!totalPlayersPerTeam || Number(totalPlayersPerTeam) <= 0)
      return "Select players per team.";
    if (isNaN(Number(maxForeignPlayers))) return "Set max foreign players.";
    if (Number(maxForeignPlayers) > Number(totalPlayersPerTeam))
      return "Foreign players can't exceed team size.";
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) {
      setAlertType("warning");
      setAlertMsg(err);
      setTimeout(() => setAlertMsg(null), 3500);
      return;
    }

    setLoading(true);
    localStorage.setItem("playerName", name);

    try {
      // POST to server — server must return the created room object (or at least roomCode)
      const res = await axios.post(`${API_BASE_URL}/api/create-room`, {
        creator: name,
        // you may omit client-side roomCode if server generates it
        roomCode, // ok to send if server honors it, but server should return canonical code
        maxPlayers: Number(maxPlayers),
        budget: Number(budget),
        dataset: dataset.toLowerCase(),
        totalPlayersPerTeam: Number(totalPlayersPerTeam),
        maxForeignPlayers: Number(maxForeignPlayers) || 0,
      });

      // Handle common response shapes robustly:
      // Prefer res.data.room.roomCode, then res.data.roomCode, then fallback to our generated code
      const serverRoom =
        res?.data?.room || res?.data || null;
      const serverCode =
        (serverRoom && (serverRoom.roomCode || serverRoom.code)) ||
        res?.data?.roomCode ||
        roomCode; // fallback

      // update local UI state to canonical server code
      setRoomCode(String(serverCode));

      // join the room on socket (tell server we are here)
      socket.emit("join-room", { roomCode: String(serverCode), name });

      setAlertType("success");
      setAlertMsg("Room created — redirecting to room...");
      setTimeout(() => navigate(`/room/${serverCode}`), 700);
    } catch (err) {
      console.error("Error creating room:", err);
      setAlertType("error");
      setAlertMsg("Failed to create room. Try again.");
      setTimeout(() => setAlertMsg(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-20">
      {alertMsg && (
        <Alert
          type={alertType}
          message={alertMsg}
          duration={3000}
          onClose={() => setAlertMsg(null)}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-3xl bg-card backdrop-blur rounded-2xl shadow-2xl border border-slate-600 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-heading font-semibold text-white">
              Create Auction Room
            </h2>
            <p className="text-sm text-slate-300">
              Quickly create a private room and invite teammates to bid.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-400">Room Code</p>
              <div className="inline-flex items-center gap-2 font-mono font-semibold text-lg text-emerald-300">
                {roomCode}
                <button
                  onClick={handleCopy}
                  aria-label="copy code"
                  className="btn btn-ghost btn-sm ml-2"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-sm text-slate-200 font-medium">
              Team Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your team or franchise name"
              className="input input-bordered w-full  text-white"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-slate-200 font-medium">
                  Max Teams
                </label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  className="select select-bordered w-full  text-white"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-200 font-medium">
                  Budget (Cr)
                </label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  min={1}
                  className="input input-bordered w-full  text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-slate-200 font-medium">
                  Players / Team
                </label>
                <select
                  value={totalPlayersPerTeam}
                  onChange={(e) => setTotalPlayersPerTeam(e.target.value)}
                  className="select select-bordered w-full  text-white"
                >
                  {[11, 12, 15, 18, 22, 25].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-200 font-medium">
                  Max Overseas
                </label>
                <input
                  type="text"
                  value={maxForeignPlayers}
                  onChange={(e) => setMaxForeignPlayers(e.target.value)}
                  className="input input-bordered w-full  text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-200 font-medium">
                League
              </label>
              <select
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
                className="select select-bordered w-full  text-white"
              >
                <option value="ipl">IPL</option>
                <option value="hundred">The Hundred</option>
                <option value="sa20">SA20</option>
                <option value="cpl">CPL</option>
                <option value="bbl">BBL</option>
                <option value="mlc">MLC</option>
                <option value="test">Test</option>
                <option value="odi">ODI</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Room Summary
              </h4>

              <div className="mt-3 text-sm text-slate-300 space-y-2">
                <div className="flex justify-between">
                  <span>Host</span>
                  <span className="font-medium">{name || "You"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Players / Team</span>
                  <span className="font-medium">{totalPlayersPerTeam}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Teams</span>
                  <span className="font-medium">{maxPlayers}</span>
                </div>
                <div className="flex justify-between">
                  <span>Budget</span>
                  <span className="font-medium">₹ {budget} Cr</span>
                </div>
                <div className="flex justify-between">
                  <span>League</span>
                  <span className="font-medium">{dataset.toUpperCase()}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleCreate}
                  className="btn btn-primary flex-1"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Room"}
                </button>
                <button
                  onClick={() => {
                    setRoomCode(generateRoomCode());
                    setAlertType("info");
                    setAlertMsg("New code generated");
                    setTimeout(() => setAlertMsg(null), 2000);
                  }}
                  className="btn  bg-card2"
                >
                  Regenerate
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <div>
                  <div className="text-xs">Auction Type</div>
                  <div className="font-medium">Live — Fast Timer</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs">
                <DollarSign className="w-4 h-4" />{" "}
                <div>
                  Min incremental bid and auto-extend on last second bids.
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-400">
                Tip: Share the room code with your participants. The host can
                start the auction once everyone joins.
              </div>
            </div>

            {/* NEW: Pro Tip / League Rule card */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-300 font-semibold">Pro tip / Rule</p>
                  <p className="font-medium">International / domestic rules</p>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400 space-y-2">
                <p>
                  By default, international leagues treat home players as <strong>India</strong> and others as <strong>foreign</strong>.
                </p>
                <p>
                  If you want a fully flexible league (allow maximum foreigners), set <strong>Max Overseas</strong> equal to <strong>Players / Team</strong>.
                </p>
                <p>
                  Other leagues are country-based — pick the league that matches your rules and adjust <em>Max Overseas</em> accordingly.
                </p>
              </div>
            </div>

            <div className="text-center text-xs text-slate-400">
              By creating a room you agree to fair-play rules.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
