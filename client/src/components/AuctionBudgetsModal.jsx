// AuctionBudgetsModal.jsx
import React, { useMemo } from "react";
import { X, Users } from "lucide-react";

export default function AuctionBudgetsModal({
  isOpen = false,
  onClose = () => {},
  room = { players: [] },
  playerName = "",
  totalPlayersPerTeam = 11,
}) {
  const otherPlayers = useMemo(
    () =>
      (room.players || []).filter(
        (p) => p.name.toLowerCase() !== (playerName || "").toLowerCase()
      ),
    [room.players, playerName]
  );

  const formatBudget = (b) => `₹${(Number(b) || 0).toFixed(2)} Cr`;

  return (
    <div className={`modal ${isOpen ? "modal-open" : ""}`}>
      <div className="modal-box w-full max-w-2xl rounded-2xl p-0 overflow-hidden bg-aucBG text-font border border-border">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-base-100/40">
          <div className="flex items-center gap-3">
            <div className="avatar">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary text-white flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-playerName">Other Teams’ Budgets</h3>
              <p className="text-xs opacity-70">Budget & squad overview</p>
            </div>
          </div>

          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {otherPlayers.length === 0 ? (
            <div className="py-10 text-center opacity-70 text-sm">No players found</div>
          ) : (
            <ul className="space-y-3">
              {otherPlayers.map((p) => {
                const teamCount = (p.team || []).length;
                const fillPct = Math.round((teamCount / totalPlayersPerTeam) * 100);

                return (
                  <li
                    key={p.name}
                    className="flex items-center justify-between bg-base-200/40 p-3 rounded-lg border border-border/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-secondary/80 to-primary/80 text-white flex items-center justify-center font-semibold">
                        {p.name.charAt(0)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{p.name}</span>
                          <span className="badge badge-outline text-[11px]">
                            {teamCount}/{totalPlayersPerTeam}
                          </span>
                        </div>
                        <p className="text-[12px] opacity-70 truncate">
                          {(p.team || []).slice(0, 3).join(", ")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-32">
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatBudget(p.budget)}</p>
                        <p className="text-[11px] opacity-70">Available</p>
                      </div>
                      <progress className="progress progress-primary w-full" value={fillPct} max="100" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/60 bg-base-100/40 text-xs opacity-70">
          Tip: Compare budgets before bidding your next player.
        </div>
      </div>
    </div>
  );
}
