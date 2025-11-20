/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function AllTeamsModal({
  room = {},
  totalPlayersPerTeam = 11,
  playerName = "",
  onClose = () => {},
  socket = null,
  preventClose = false, // NEW: when true, modal cannot be closed by ESC/backdrop
}) {
  const dialogRef = useRef(null);

  // UI state
  const [query, setQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [viewMode, setViewMode] = useState("detailed");
  const [onlyShowIncomplete, setOnlyShowIncomplete] = useState(false);

  // messages & warnings
  const [warning, setWarning] = useState(null);
  const [message, setMessage] = useState("");

  // socket & inbox/trade
  const [socketStatus, setSocketStatus] = useState(
    socket?.connected ? `✅ connected (${socket.id})` : "Socket not connected"
  );
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeTargetOwner, setTradeTargetOwner] = useState(null);
  const [tradeRequestedPlayer, setTradeRequestedPlayer] = useState(null);
  const [offeredPlayerName, setOfferedPlayerName] = useState("");
  const [offeredCash, setOfferedCash] = useState(0);

  // inbox
  const [inboxOpen, setInboxOpen] = useState(true);
  const [incomingTrades, setIncomingTrades] = useState([]);

  useEffect(() => {
    const modal = dialogRef.current;
    if (!modal) return;

    const blockClose = (e) => {
      e.preventDefault();
      try {
        if (!modal.open) modal.showModal();
      } catch (err) {}
    };

    modal.addEventListener("cancel", blockClose);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        e.stopPropagation();
        try {
          if (!modal.open) modal.showModal();
        } catch (err) {}
      }
    });

    return () => modal.removeEventListener("cancel", blockClose);
  }, []);

  const copyTeamToClipboard = (ownerName, roster) => {
    const list = roster
      .map((p) => `${p.name} (${p.role}) - ₹${p.price ?? p.basePrice ?? 0} Cr`)
      .join("\n");

    const text = `${ownerName}'s Team:\n\n${list}`;

    navigator.clipboard.writeText(text).then(() => {
      setMessage(`Copied ${ownerName}'s team to clipboard`);
      setTimeout(() => setMessage(""), 2500);
    });
  };

  // helpers
  const getOwnerName = (owner, idx) =>
    String(
      owner?.name ?? owner?.playerName ?? owner?.NAME ?? `Team ${idx + 1}`
    );
  const formatPlayerName = (n) => {
    if (!n) return "Unknown";
    return String(n)
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isForeign = (dataset, nation) => {
    if (!nation || !dataset) return false;
    const ds = String(dataset).trim().toLowerCase();
    const n = String(nation).trim().toLowerCase();
    if (ds === "ipl") return n !== "india";
    if (ds === "hundred") return n !== "england";
    if (ds === "sa20") return n !== "south africa";
    if (ds === "cpl") return n !== "west indies";
    if (ds === "bbl") return n !== "australia";
    if (ds === "mlc") return n !== "usa";
    if (ds === "test") return n !== "india";
    if (ds === "odi") return n !== "india";
    return false;
  };

  const players = Array.isArray(room?.players) ? room.players : [];
  const AVAILABLE_ROLES = ["Batter", "Bowler", "All-Rounder", "WK-Batter"];

  const toggleRole = (role) =>
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  const clearFilters = () => {
    setQuery("");
    setSelectedRoles([]);
    setViewMode("detailed");
    setOnlyShowIncomplete(false);
  };

  // requester + my team
  const requester = players.find(
    (p) => (p.name || "").toLowerCase() === (playerName || "").toLowerCase()
  );
  const myTeam = requester?.team || [];

  // Build filtered owners — INCLUDE the current user's owner entry so 'My Team' shows
  const filteredOwners = useMemo(() => {
    const q = String(query ?? "")
      .trim()
      .toLowerCase();

    const list = players
      .map((owner, idx) => {
        const ownerName = getOwnerName(owner, idx);
        const roster = Array.isArray(owner.team) ? owner.team : [];
        return { owner, idx, ownerName, roster };
      })
      .filter(({ ownerName, roster }) => {
        // incomplete filter
        if (
          onlyShowIncomplete &&
          roster.length >= (totalPlayersPerTeam ?? Infinity)
        )
          return false;

        // role filter: owner must have at least one player of selected role(s) to show
        if (selectedRoles.length > 0) {
          const hasRole = selectedRoles.some((role) =>
            roster.some(
              (p) =>
                String(p.role ?? p.ROLE ?? "").toLowerCase() ===
                role.toLowerCase()
            )
          );
          if (!hasRole) return false;
        }

        if (!q) return true;

        // match owner name
        if (ownerName.toLowerCase().includes(q)) return true;

        // match any player name in roster
        const anyPlayerMatch = roster.some((p) =>
          String(p.name ?? p.playerName ?? p.NAME ?? "")
            .toLowerCase()
            .includes(q)
        );
        return anyPlayerMatch;
      });

    // Put current player at top (if present)
    const lowerPlayer = (playerName || "").toLowerCase();
    const mine = list.filter(
      (l) => (l.ownerName || "").toLowerCase() === lowerPlayer
    );
    const others = list.filter(
      (l) => (l.ownerName || "").toLowerCase() !== lowerPlayer
    );
    return [...mine, ...others];
  }, [
    players,
    query,
    selectedRoles,
    onlyShowIncomplete,
    totalPlayersPerTeam,
    playerName,
  ]);

  function cryptoId() {
    try {
      return (
        (typeof crypto !== "undefined" &&
          crypto.randomUUID &&
          crypto.randomUUID()) ||
        `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      );
    } catch (err) {
      return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
  }

  const sendTradeRequest = () => {
  if (!socket || !socket.connected) {
    setWarning({
      title: "Socket disconnected",
      body: "You're not connected to the server. Please retry.",
    });
    return;
  }
  if (!tradeTargetOwner || !tradeRequestedPlayer || !playerName) {
    setWarning({
      title: "Missing details",
      body: "Please select a player to request and try again.",
    });
    return;
  }

  // Gather room & players
  const owner = (room?.players || []).find(
    (p) => (p.name || "").trim().toLowerCase() === (tradeTargetOwner || "").trim().toLowerCase()
  );
  const requesterObj = (room?.players || []).find(
    (p) => (p.name || "").trim().toLowerCase() === (playerName || "").trim().toLowerCase()
  );

  const totalPlayersLimit = Number(room?.totalPlayersPerTeam || 0);
  const maxForeign = typeof room?.maxForeignPlayers === "number" ? Number(room.maxForeignPlayers) : null;
  const dataset = room?.dataset;

  const clientIsForeign = (nation) => {
    if (!nation || !dataset) return false;
    const ds = String(dataset).trim().toLowerCase();
    const n = String(nation).trim().toLowerCase();
    if (ds === "ipl") return n !== "india";
    if (ds === "hundred") return n !== "england";
    if (ds === "sa20") return n !== "south africa";
    if (ds === "cpl") return n !== "west indies";
    if (ds === "bbl") return n !== "australia";
    if (ds === "mlc") return n !== "usa";
    if (ds === "test") return n !== "india";
    if (ds === "odi") return n !== "india";
    return false;
  };

  // offered player (if any) and requested player
  const offeredPlayer = myTeam.find((p) => p.name === offeredPlayerName) || null;
  const requested = tradeRequestedPlayer;

  // team sizes after swap
  const fromSizeAfter = (myTeam.length - (offeredPlayer ? 1 : 0) + 1);
  const toSizeAfter = (Array.isArray(owner?.team) ? owner.team.length : 0) - 1 + (offeredPlayer ? 1 : 0);

  if (totalPlayersLimit > 0) {
    if (fromSizeAfter > totalPlayersLimit) {
      setWarning({
        title: "Team full",
        body: "Your team is full. Offer one of your players in the trade or remove a player before requesting.",
      });
      return;
    }
    if (toSizeAfter > totalPlayersLimit) {
      setWarning({
        title: "Owner team full",
        body: `${tradeTargetOwner} would exceed team size if this trade completes. Choose another target or offer a player.`,
      });
      return;
    }
  }

  if (typeof maxForeign === "number") {
    const countForeign = (team, excludeName = null) =>
      (team || []).reduce((acc, p) => {
        if (!p) return acc;
        if (excludeName && (p.name || "").trim().toLowerCase() === excludeName.trim().toLowerCase()) return acc;
        return acc + (clientIsForeign(p.nation) ? 1 : 0);
      }, 0);

    const myForeignExclOffered = offeredPlayer ? countForeign(myTeam, offeredPlayer.name) : countForeign(myTeam);
    const ownerTeam = Array.isArray(owner?.team) ? owner.team : [];
    const ownerForeignExclRequested = requested?.name ? countForeign(ownerTeam, requested.name) : countForeign(ownerTeam);

    const fromForeignAfter = myForeignExclOffered + (clientIsForeign(requested?.nation) ? 1 : 0);
    const toForeignAfter = ownerForeignExclRequested + (offeredPlayer ? (clientIsForeign(offeredPlayer.nation) ? 1 : 0) : 0);

    if (fromForeignAfter > maxForeign) {
      setWarning({
        title: "Foreign limit reached",
        body: `You would exceed the foreign player limit (${maxForeign}). Offer a foreign player in return or pick a different player.`,
      });
      return;
    }
    if (toForeignAfter > maxForeign) {
      setWarning({
        title: "Target owner foreign limit",
        body: `${tradeTargetOwner} would exceed the foreign player limit if this trade completes.`,
      });
      return;
    }
  }

  // budget check for cash-only offers
  const offerCash = Number(offeredCash) || 0;
  if (!offeredPlayer && offerCash > (requesterObj?.budget || 0)) {
    setWarning({
      title: "Insufficient cash",
      body: "You do not have enough budget to make this cash-only offer.",
    });
    return;
  }

  // Build request and emit
  const req = {
    _id: cryptoId(),
    from: playerName,
    to: tradeTargetOwner,
    playerRequested: tradeRequestedPlayer,
    offeredPlayer: offeredPlayer || null,
    cashOffered: Number(offeredCash) || 0,
    status: "pending",
    createdAt: new Date().toISOString(),
  };


  // after building `req` (before socket.emit or after — either works)
try {
  window.dispatchEvent(
    new CustomEvent("live:trade-request-sent", { detail: req })
  );
} catch (err) {
  // fallback/no-op
}


  let done = false;
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    setWarning({
      title: "No server response",
      body: "Server did not acknowledge the trade request.",
    });
  }, 6000);

  socket.emit(
    "send-trade-request",
    { roomCode: room.roomCode, request: req },
    (response) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!response) {
        setWarning({
          title: "No response",
          body: "Server did not return a response.",
        });
        return;
      }
      if (response.error) {
        setWarning({ title: "Trade failed", body: response.error });
        return;
      }
      setMessage("Trade request sent");
      setTradeModalOpen(false);
      socket.emit("get-room");
    }
  );
};


  const respondToIncoming = (requestId, accept) => {
    if (!socket) {
      setWarning({
        title: "Socket disconnected",
        body: "Can't respond while disconnected.",
      });
      return;
    }
    socket.emit(
      "respond-trade-request",
      { roomCode: room.roomCode, requestId, accept, responderName: playerName },
      (resp) => {
        setMessage(resp?.message || (accept ? "Accepted" : "Declined"));
        setIncomingTrades((prev) => prev.filter((r) => r._id !== requestId));
        socket.emit("get-room");
      }
    );
  };

  // socket listeners
  useEffect(() => {
    if (!socket) return;
    const onIncoming = (req) => setIncomingTrades((prev) => [req, ...prev]);
    const onTradeUpdated = (payload) => {
      setMessage(payload.message || "");
      socket.emit("get-room");
    };
    const onTradeExecuted = (payload) => {
      setMessage(payload.message || "Trade executed");
      socket.emit("get-room");
    };
    const onTradeDeclined = (payload) => {
      setMessage(payload.message || "Trade declined");
      socket.emit("get-room");
    };

    socket.on("incoming-trade-request", onIncoming);
    socket.on("trade-request-updated", onTradeUpdated);
    socket.on("trade-executed", onTradeExecuted);
    socket.on("trade-declined", onTradeDeclined);

    return () => {
      socket.off("incoming-trade-request", onIncoming);
      socket.off("trade-request-updated", onTradeUpdated);
      socket.off("trade-executed", onTradeExecuted);
      socket.off("trade-declined", onTradeDeclined);
    };
  }, [socket]);

  // fetch pending requests on mount
  useEffect(() => {
    if (!socket) return;
    socket.emit("get-trade-requests", null, (resp) => {
      if (resp?.requests?.length) setIncomingTrades(resp.requests);
    });
  }, [socket]);

  // connection listeners
  useEffect(() => {
    if (!socket) {
      setSocketStatus("Socket not connected");
      return;
    }
    const onConnect = () => setSocketStatus(`✅ connected (${socket.id})`);
    const onDisconnect = (reason) =>
      setSocketStatus(`Socket disconnected (${reason || "unknown"})`);
    const onConnectError = (err) =>
      setWarning({ title: "Connection error", body: String(err || "Unknown") });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    setSocketStatus(
      socket.connected ? `✅ connected (${socket.id})` : "Socket not connected"
    );

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [socket]);

  const openTradeModal = (targetOwnerName, targetPlayer) => {
    setTradeTargetOwner(targetOwnerName);
    setTradeRequestedPlayer(targetPlayer);
    setOfferedPlayerName("");
    setOfferedCash(0);
    setTradeModalOpen(true);
  };

  // ---------- Render UI (visuals only; logic preserved) ----------
  return (
    <dialog id="allTeamsModal" ref={dialogRef} className="modal">
      <div className="modal-box w-full max-w-7xl  bg-auc text-base-content border border-base-200 shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between p-5 border-b gap-4 bg-clip-padding backdrop-blur-md">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">All Teams</h3>
            <p className="text-sm text-muted truncate">
              Live rosters · search owners or players · quick trades
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 bg-base-200 rounded-full px-3 py-1">
              <div className="text-xs text-muted pr-2">View</div>
              <div className="btn-group">
                <button
                  className={`btn btn-sm ${
                    viewMode === "detailed" ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => setViewMode("detailed")}
                >
                  Detailed
                </button>
                <button
                  className={`btn btn-sm ${
                    viewMode === "compact" ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => setViewMode("compact")}
                >
                  Compact
                </button>
              </div>
            </div>

            <button
              className="btn btn-ghost btn-sm relative"
              onClick={() => setInboxOpen((v) => !v)}
              aria-pressed={inboxOpen}
              title="Inbox"
            >
              <span className="sr-only">Inbox</span>📥
              {incomingTrades.length > 0 && (
                <span className="indicator-item badge badge-sm badge-primary absolute -top-2 -right-2">
                  {incomingTrades.length}
                </span>
              )}
            </button>

            {!preventClose && (
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Close"
                onClick={() => {
                  try {
                    dialogRef.current?.close();
                  } catch (err) {}
                  onClose();
                }}
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {/* Controls */}
        <div className="px-6 py-4 border-b bg-card">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex-1 flex items-center gap-3">
              <div className="relative w-full">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search owner or player — e.g. 'Alex' or 'Kohli'"
                  className="input input-sm input-bordered w-full pr-28 rounded-lg"
                  aria-label="Search owners and players"
                />
                <button
                  className="btn btn-xs btn-ghost absolute right-1 top-1"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-2 items-center flex-wrap">
                {AVAILABLE_ROLES.map((r) => {
                  const active = selectedRoles.includes(r);
                  return (
                    <button
                      key={r}
                      className={`btn btn-xs ${
                        active ? "btn-primary" : "btn-outline"
                      }`}
                      onClick={() => toggleRole(r)}
                      aria-pressed={active}
                      title={`Filter by ${r}`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={onlyShowIncomplete}
                  onChange={(e) => setOnlyShowIncomplete(e.target.checked)}
                />
                <span className="text-xs">Only incomplete</span>
              </label>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="p-6 max-h-[72vh] overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams list (NOW includes my team at top) */}
          <div className="col-span-1 lg:col-span-2 space-y-4">
            {message && (
              <div className="p-3 rounded-md bg-success/10 text-success text-sm">
                {message}
              </div>
            )}

            {filteredOwners.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted">
                No owners or players match your filters
              </div>
            ) : viewMode === "compact" ? (
              <div className="space-y-3">
                {filteredOwners.map(
                  ({ owner, idx, ownerName, roster }, listIndex) => {
                    const budget = Number(
                      owner.budget ?? room.budget ?? 0
                    ).toFixed(2);
                    const displayedPlayers =
                      selectedRoles.length > 0
                        ? roster.filter((p) =>
                            selectedRoles.some(
                              (role) =>
                                String(p.role ?? p.ROLE ?? "").toLowerCase() ===
                                role.toLowerCase()
                            )
                          )
                        : roster;
                    const isMine =
                      (ownerName || "").toLowerCase() ===
                      (playerName || "").toLowerCase();

                    return (
                      <motion.div
                        key={ownerName + idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: listIndex * 0.03 }}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isMine
                            ? "border-primary/30 bg-primary/5"
                            : "bg-base-200/30 border-base-200"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {isMine ? `${ownerName} (You)` : ownerName}
                          </div>
                          <div className="text-xs text-muted">
                            {displayedPlayers.length} / {totalPlayersPerTeam}{" "}
                            shown
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-xs text-muted">Budget</div>
                          <div className="font-semibold">₹{budget} Cr</div>
                          {isMine ? (
                            <button
                              className="btn btn-xs btn-outline"
                              disabled
                              title="Your team — no trade allowed"
                            >
                              Your Team
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => setViewMode("detailed")}
                            >
                              Details
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredOwners.map(
                  ({ owner, idx, ownerName, roster }, listIndex) => {
                    const budget = Number(
                      owner.budget ?? room.budget ?? 0
                    ).toFixed(2);
                    const roles = AVAILABLE_ROLES;
                    const isMine =
                      (ownerName || "").toLowerCase() ===
                      (playerName || "").toLowerCase();

                    return (
                      <motion.div
                        key={ownerName + idx}
                        initial={{ opacity: 0, scale: 0.995 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18, delay: listIndex * 0.03 }}
                        className={`rounded-2xl p-4 shadow-sm border ${
                          isMine
                            ? "border-primary/30 bg-bg"
                            : "border-outline bg-bg"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate text-white">
                              {isMine ? `${ownerName} (You)` : ownerName}
                            </div>
                            <div className="text-xs text-muted">
                              {roster.length} / {totalPlayersPerTeam} players
                            </div>
                          </div>

                          <div className="text-right flex items-center gap-2">
                            <div className="text-xs text-muted">Budget</div>
                            <span className="font-semibold text-sm">₹{budget} Cr</span>

                            <button
                              className="btn btn-xs btn-outline rounded-md text-muted"
                              onClick={() =>
                                copyTeamToClipboard(ownerName, roster)
                              }
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {roles.map((role) => {
                            if (
                              selectedRoles.length > 0 &&
                              !selectedRoles.includes(role)
                            )
                              return null;

                            const playersByRole = roster.filter(
                              (p) =>
                                String(p.role ?? p.ROLE ?? "").toLowerCase() ===
                                role.toLowerCase()
                            );
                            if (playersByRole.length === 0) return null;

                            return (
                              <div
                                key={role}
                                className="bg-card rounded-md p-3 border hover:border-highlight/20"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <h5 className="text-xs font-semibold uppercase tracking-wide text-white">
                                    {role}s
                                  </h5>
                                  <span className="text-[11px] text-muted">
                                    {playersByRole.length}
                                  </span>
                                </div>

                                <ul className="divide-y divide-border/40 text-[13px] font-medium">
                                  {playersByRole.map((p, i) => {
                                    const foreign = isForeign(
                                      room.dataset,
                                      p.nation
                                    );
                                    const formattedName = formatPlayerName(
                                      p.name ?? p.NAME ?? p.playerName ?? ""
                                    );
                                    const price = Number(
                                      p.price ?? p.PRICE ?? p.basePrice ?? 0
                                    );

                                    return (
                                      <li
                                        key={(formattedName || "player") + i}
                                        className="flex justify-between items-center py-2"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm text-white">
                                              {formattedName || "Unknown"}
                                            </div>
                                            <div className="text-[11px] text-muted">
                                              {p.role} · {p.nation ?? ""}{" "}
                                              {foreign ? "· Intl" : ""}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <div className="text-bid font-semibold text-[13px] text-white">
                                            ₹{price} cr
                                          </div>

                                          {isMine ? (
                                            <button
                                              className="btn btn-xs btn-outline"
                                              disabled
                                              title="Cannot trade your own players"
                                            >
                                              Owned
                                            </button>
                                          ) : (
                                            <button
                                              className="btn btn-xs btn-outline  btn-accent"
                                              onClick={() =>
                                                openTradeModal(ownerName, p)
                                              }
                                            >
                                              Trade
                                            </button>
                                          )}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  }
                )}
              </div>
            )}
          </div>

       {/* Inbox (REPLACED) */}
{/* Desktop: sticky sidebar (visible on lg and up) */}
<aside className="hidden lg:block col-span-1">
  <div className="bg-gradient-to-b from-[#071427] to-[#041021] border border-base-800 rounded-2xl p-4 shadow-lg sticky top-4">
    <div className="flex items-center justify-between mb-3">
      <div>
        <h4 className="text-sm font-semibold">Inbox</h4>
        <div className="text-xs text-neutral-400">Real-time trade requests</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs text-neutral-400">{incomingTrades.length} •</div>
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => setInboxOpen((v) => !v)}
          title="Toggle inbox"
        >
          {inboxOpen ? "Hide" : "Show"}
        </button>
      </div>
    </div>

    {incomingTrades.length === 0 ? (
      <div className="text-sm text-neutral-500 py-6 text-center">No incoming trade requests</div>
    ) : (
      <div className="space-y-3 max-h-[56vh] overflow-y-auto pr-2">
        {incomingTrades.map((req, idx) => (
          <motion.div
            key={req._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: idx * 0.03 }}
            className="p-3 bg-gradient-to-r from-[#031022] to-transparent border border-base-800 rounded-lg hover:shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{req.from} → You</div>
                    <div className="text-xs text-neutral-400 truncate">Requested: <span className="font-semibold text-accent">{req.playerRequested?.name ?? 'Unknown'}</span></div>
                  </div>

                  <div className="text-right text-xs text-neutral-400">
                    {new Date(req.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-neutral-300">Offered</div>
                    {req.offeredPlayer ? (
                      <div className="px-2 py-1 rounded-md border border-base-800 text-sm bg-base-900/40">{req.offeredPlayer.name} • ₹{req.offeredPlayer.price ?? req.offeredPlayer.basePrice ?? 0}</div>
                    ) : req.cashOffered > 0 ? (
                      <div className="px-2 py-1 rounded-md border border-base-800 text-sm bg-base-900/40">₹{req.cashOffered}</div>
                    ) : (
                      <div className="px-2 py-1 rounded-md text-xs text-neutral-500">None</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="btn btn-xs btn-ghost" onClick={() => respondToIncoming(req._id, false)} aria-label="Decline request">Decline</button>
                    <button className="btn btn-xs btn-primary" onClick={() => respondToIncoming(req._id, true)} aria-label="Accept request">Accept</button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    )}

    <div className="mt-4 text-xs text-muted">
      Tap a request to accept or decline. You can also view details before responding.
    </div>
  </div>
</aside>

{/* Mobile: full-screen drawer/modal (visible below lg) */}
{inboxOpen && (
  <div className="lg:hidden fixed inset-0 z-50 flex">
    {/* Backdrop */}
    <button
      className="absolute inset-0 bg-black/60"
      aria-label="Close inbox"
      onClick={() => setInboxOpen(false)}
    />

    <div className="relative w-full max-w-md ml-auto h-full overflow-auto p-4">
      <div className="h-full flex flex-col bg-gradient-to-b from-[#071427] to-[#041021] border border-base-800 rounded-l-2xl p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold">Inbox</h4>
            <div className="text-xs text-neutral-400">Real-time trade requests</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-neutral-400">{incomingTrades.length} •</div>
            <button className="btn btn-ghost btn-xs" onClick={() => setInboxOpen(false)} aria-label="Close inbox">Close</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {incomingTrades.length === 0 ? (
            <div className="text-sm text-neutral-500 py-6 text-center">No incoming trade requests</div>
          ) : (
            incomingTrades.map((req, idx) => (
              <motion.div
                key={req._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: idx * 0.03 }}
                className="p-3 bg-gradient-to-r from-[#031022] to-transparent border border-base-800 rounded-lg hover:shadow-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{req.from} → You</div>
                        <div className="text-xs text-neutral-400 truncate">Requested: <span className="font-semibold text-accent">{req.playerRequested?.name ?? 'Unknown'}</span></div>
                      </div>

                      <div className="text-right text-xs text-neutral-400">
                        {new Date(req.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-neutral-300">Offered</div>
                        {req.offeredPlayer ? (
                          <div className="px-2 py-1 rounded-md border border-base-800 text-sm bg-base-900/40">{req.offeredPlayer.name} • ₹{req.offeredPlayer.price ?? req.offeredPlayer.basePrice ?? 0}</div>
                        ) : req.cashOffered > 0 ? (
                          <div className="px-2 py-1 rounded-md border border-base-800 text-sm bg-base-900/40">₹{req.cashOffered}</div>
                        ) : (
                          <div className="px-2 py-1 rounded-md text-xs text-neutral-500">None</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="btn btn-xs btn-ghost" onClick={() => respondToIncoming(req._id, false)} aria-label="Decline request">Decline</button>
                        <button className="btn btn-xs btn-primary" onClick={() => respondToIncoming(req._id, true)} aria-label="Accept request">Accept</button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="mt-4 text-xs text-muted">
          Tap a request to accept or decline. You can also view details before responding.
        </div>
      </div>
    </div>
  </div>
)}

        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-gradient-to-t from-transparent to-transparent">
          <div className="text-xs text-neutral-400">Close to return to the auction view — no navigation.</div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm"
              onClick={() => {
                try {
                  if (!preventClose) {
                    dialogRef.current?.close();
                  }
                } catch (err) {}
                onClose();
              }}
            >
              {preventClose ? "Home" : "Close"}
            </button>
          </div>
        </footer>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close backdrop" />
        </form>
      </div>

            {/* Trade sheet modal (UI-only changes; logic preserved) */}
      {tradeModalOpen && (
        <dialog open className="modal">
          <div className="modal-box max-w-xl rounded-2xl bg-gradient-to-br from-[#071427] to-[#031122] text-white border border-base-800 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-bold text-lg">Send Trade Request</h3>
                <p className="py-1 text-sm text-neutral-400">Request <strong>{tradeRequestedPlayer?.name}</strong> from <strong>{tradeTargetOwner}</strong></p>

                <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                  <div className="px-2 py-1 rounded-md border border-base-800">From: <span className="font-semibold">{playerName}</span></div>
                  <div className="px-2 py-1 rounded-md border border-base-800">To: <span className="font-semibold">{tradeTargetOwner}</span></div>
                  <div className="px-2 py-1 rounded-md border border-base-800">Player: <span className="font-semibold">{tradeRequestedPlayer?.name}</span></div>
                </div>
              </div>

              <div className="text-xs text-neutral-400">{socketStatus}</div>
            </div>

            <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs">Offer one of your players (optional)</label>
                <div className="mt-2">
                  <select
                    className="select select-bordered w-full bg-base-900 text-white"
                    value={offeredPlayerName}
                    onChange={(e) => setOfferedPlayerName(e.target.value)}
                  >
                    <option value="">-- No player offered --</option>
                    {myTeam.map((p) => (
                      <option key={p.name} value={p.name}>{p.name} ({p.role}) — ₹{p.price ?? p.basePrice ?? 0}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 text-xs text-neutral-400">Select a player to include in the offer. You can still add cash below.</div>
              </div>

              <div>
                <label className="text-xs">Or offer cash (₹)</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered w-full bg-base-900 text-white"
                    value={offeredCash}
                    onChange={(e) => setOfferedCash(e.target.value)}
                  />
                  <div className="flex flex-col gap-2">
                    <button type="button" className="btn btn-xs" onClick={() => setOfferedCash(2)}>₹2</button>
                    <button type="button" className="btn btn-xs" onClick={() => setOfferedCash(5)}>₹5</button>
                  </div>
                </div>

                <div className="mt-3 text-xs text-neutral-400">Quick presets for fast offers. You can fine-tune the number before sending.</div>
              </div>
            </div>

            <div className="py-2 border-t border-base-800 mt-2 flex items-center justify-between">
              <div className="text-xs text-neutral-400">Preview: {offeredPlayerName ? `Offering ${offeredPlayerName}` : 'No player offered'}{offeredCash ? ` + ₹${offeredCash}` : ''}</div>

              <div className="flex items-center gap-2">
                <button className="btn" onClick={() => setTradeModalOpen(false)}>Cancel</button>
                <motion.button
                  className="btn btn-primary"
                  onClick={sendTradeRequest}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ boxShadow: '0 6px 18px rgba(59,130,246,0.08)' }}
                  animate={{ boxShadow: '0 10px 30px rgba(59,130,246,0.14)' }}
                >
                  Send Request
                </motion.button>
              </div>
            </div>
          </div>
        </dialog>
      )}


      {/* Warning modal */}
      {warning && (
        <dialog open className="modal">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg">{warning.title}</h3>
            <p className="py-2 text-sm text-muted">{warning.body}</p>
            <div className="modal-action">
              <button className="btn" onClick={() => setWarning(null)}>
                OK
              </button>
            </div>
          </div>
        </dialog>
      )}
    </dialog>
  );
}
