/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";
import { Copy, Home } from "lucide-react";

/**
 * TeamSquadAllTeams — Modern UI, no gradients
 */
export default function TeamSquad() {
  const [room, setRoom] = useState(null);
  const [copied, setCopied] = useState(false);
  const [debug, setDebug] = useState(false); // flip to true to show debug info
  const playerName = (localStorage.getItem("playerName") || "").trim();
  const navigate = useNavigate();

  // Helper: robust parse of team array from several shapes
  const parseTeamArray = (entry) => {
    if (!entry) return [];
    if (Array.isArray(entry)) return entry;
    if (Array.isArray(entry.team)) return entry.team;
    if (Array.isArray(entry.players)) return entry.players;
    if (Array.isArray(entry.squad)) return entry.squad;
    if (Array.isArray(entry.data)) return entry.data;
    for (const k of Object.keys(entry || {})) {
      if (Array.isArray(entry[k])) return entry[k];
    }
    return [];
  };

  useEffect(() => {
    const onRoomData = (r) => {
      if (!r) return;
      setRoom(r);
    };

    const onTeamData = (t) => {
      // If server sends full room in team-data
      if (t && (Array.isArray(t.players) || t.roomCode || t.id)) {
        setRoom(t);
        return;
      }
    };

    socket.on("room-data", onRoomData);
    socket.on("team-data", onTeamData);
    socket.on("team", onTeamData);

    socket.emit("get-room");
    socket.emit("get-team", { playerName });

    return () => {
      socket.off("room-data", onRoomData);
      socket.off("team-data", onTeamData);
      socket.off("team", onTeamData);
    };
  }, [playerName]);

  // Compute stats for an owner/team
  const computeTeamStats = (teamArr = [], owner = {}) => {
    const totalPlayers = teamArr.length;
    const spent = teamArr.reduce((s, p) => s + Number(p.price || 0), 0);
    const budget = Number(owner?.budget ?? room?.budget ?? 0);
    const remaining = Math.max(0, +(budget - spent).toFixed(2));
    const groupedCounts = {
      Batter: teamArr.filter((p) => (p.role || "").toLowerCase() === "batter").length,
      "All-Rounder": teamArr.filter((p) => (p.role || "").toLowerCase() === "all-rounder").length,
      Bowler: teamArr.filter((p) => (p.role || "").toLowerCase() === "bowler").length,
      "WK-Batter": teamArr.filter((p) => (p.role || "").toLowerCase() === "wk-batter").length,
    };
    return { totalPlayers, spent, budget, remaining, groupedCounts };
  };

  // Copy all teams
  const copyAllTeams = () => {
    if (!room || !Array.isArray(room.players)) return;
    const lines = [];
    room.players.forEach((plr, idx) => {
      const ownerName = plr?.name ?? plr?.playerName ?? `player#${idx + 1}`;
      const teamArr = parseTeamArray(plr) || [];
      lines.push(`=== ${ownerName} — ${teamArr.length} players ===`);
      teamArr.forEach((p, i) => {
        lines.push(`${String(i + 1).padStart(2, "0")}. ${p.name || p.player || "<unknown>"} — ${p.role || "-"} — ₹${p.price ?? 0} Cr — ${p.nation ?? "-"}`);
      });
      lines.push("");
    });
    navigator.clipboard?.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Team card UI
  const TeamCard = ({ owner }) => {
    const ownerName = owner?.name ?? owner?.playerName ?? owner?.displayName ?? "<owner>";
    const teamArr = parseTeamArray(owner);
    const stats = computeTeamStats(teamArr, owner);

    // avatar/initial
    const initial = (ownerName || "?").slice(0, 1).toUpperCase();

    return (
      <div className="bg-white/30 dark:bg-[#0b1220] rounded-2xl p-4 border border-base-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-playerName/10 text-playerName font-bold flex items-center justify-center text-lg">
              {initial}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold truncate text-playerName">{ownerName}</div>
              <div className="text-xs text-muted mt-0.5 truncate">
                {stats.totalPlayers} players • Budget ₹{stats.budget}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-sm font-semibold">₹{stats.spent.toFixed(2)} Cr</div>
            <div className="text-[11px] text-muted">Spent</div>
          </div>
        </div>

        <div className="space-y-2">
          {teamArr.length === 0 ? (
            <div className="text-sm text-muted py-2">No players yet</div>
          ) : (
            teamArr.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-md bg-base-100/60 border border-base-200">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name ?? p.player ?? "<unknown>"}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] px-2 py-0.5 bg-playerName/10 rounded text-playerName">{(p.role || "").toUpperCase() || "—"}</span>
                    <span className="text-[11px] text-muted">{p.nation ?? "-"}</span>
                  </div>
                </div>

                <div className="text-right min-w-[84px]">
                  <div className="font-medium">₹{Number(p.price || 0).toFixed(2)}</div>
                  <div className="text-[11px] text-muted">Price</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // When no room yet
  if (!room) {
    return (
      <div className="min-h-screen bg-aucBG text-font font-text p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h2 className="text-2xl font-semibold">Waiting for room data…</h2>
          <p className="text-sm text-muted mt-2">The server is syncing room information — please wait.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => { socket.emit("get-room"); }} className="px-4 py-2 rounded-xl bg-primary text-white shadow-sm hover:bg-primary/95 active:scale-[0.98]">Retry</button>
            <button onClick={() => navigate("/")} className="px-4 py-2 rounded-xl bg-card border border-base-200">Home</button>
          </div>
        </div>
      </div>
    );
  }

  // owners array
  const owners = Array.isArray(room.players) && room.players.length > 0
    ? room.players
    : [{ name: playerName || "You", team: parseTeamArray(room) }];

  return (
    <div className="min-h-screen bg-aucBG text-font font-text p-6">
      <div className="max-w-7xl mx-auto">

        {/* header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-playerName">All Teams</h1>
            <p className="text-sm text-muted mt-1">View every team's squad in the room — clean, compact, and responsive.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyAllTeams}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${copied ? "bg-success text-black" : "bg-card"} border border-base-200 shadow-sm hover:shadow-md active:scale-[0.98]`}
            >
              <Copy size={16} />
              <span className="text-sm font-semibold">{copied ? "Copied!" : "Copy All"}</span>
            </button>

            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-base-200 hover:bg-card/90 active:scale-[0.98]"
            >
              <Home size={16} />
              <span className="text-sm">Home</span>
            </button>
          </div>
        </div>

        {/* debug */}
        {debug && (
          <div className="mb-4 text-xs text-muted">
            <div>Room id: <strong>{room?.id ?? room?.roomCode ?? "<none>"}</strong></div>
            <div>Players in room: <strong>{Array.isArray(room.players) ? room.players.length : 0}</strong></div>
          </div>
        )}

        {/* grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {owners.map((owner, idx) => (
            <TeamCard key={idx} owner={owner} />
          ))}
        </div>
      </div>
    </div>
  );
}
