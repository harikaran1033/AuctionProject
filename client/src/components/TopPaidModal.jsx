/* eslint-disable no-unused-vars */
import React, { useMemo } from "react";

/**
 * TopPaidModal.jsx
 * Props:
 *  - topPlayers: array
 *  - roomCode: optional string (used to read localStorage fallback)
 *  - onClose: function
 */
export default function TopPaidModal({ topPlayers = [], roomCode = "", onClose = () => {} }) {
  // defensive normalized list (prefer prop, then localStorage fallback)
  const players = useMemo(() => {
    if (Array.isArray(topPlayers) && topPlayers.length > 0) return topPlayers;
    try {
      if (roomCode) {
        const raw = localStorage.getItem(`topPlayers_${roomCode}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return [];
  }, [topPlayers, roomCode]);

  // helpful debug string (show this inside modal if empty)
  const debugHint = !players.length
    ? `No top players available. Prop length=${(topPlayers || []).length}. localStorage key=${roomCode ? `topPlayers_${roomCode}` : "(no roomCode)"}`
    : "";

  return (
    <dialog id="topPaidModal" className="modal">
      <div className="modal-box w-full max-w-2xl rounded-xl p-0 overflow-hidden bg-base-100 text-base-content border border-base-200 shadow-lg">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-base-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold truncate">Top 10 Highest-Paid Players</h3>
              <p className="text-xs text-muted truncate">Showcasing current top contracts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost btn-sm btn-circle"
              aria-label="Close"
              onClick={() => {
                document.getElementById("topPaidModal")?.close();
                onClose();
              }}
            >
              ✕
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {players && players.length > 0 ? (
            <ul className="space-y-3">
              {players.slice(0, 10).map((p, i) => {
                const buyer = p.boughtBy ?? p.buyer ?? p.team ?? p.winner ?? "—";
                const price = p.price ?? p.PRICe ?? p.amount ?? 0;
                return (
                  <li
                    key={p.id ?? p.name ?? i}
                    className={`grid grid-cols-[48px_1fr_96px] sm:grid-cols-[48px_1fr_160px_120px] items-center gap-4 p-3 rounded-lg border border-base-200 bg-base-200/40 transition-all ${
                      i === 0 ? "shadow-md scale-[1.02] border-yellow-300/30" : "hover:bg-base-100/60"
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-12 flex items-center justify-center">
                      <div className={`text-xl font-semibold ${i === 0 ? "text-yellow-500" : "text-muted"}`}>
                        {i === 0 ? "👑" : i + 1}
                      </div>
                    </div>

                    {/* Name */}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name ?? "Unknown"}</div>
                      <div className="text-xs text-muted truncate">{p.nation ?? p.role ?? ""}</div>
                    </div>

                    {/* Buyer */}
                    <div className="hidden sm:flex items-center justify-center">
                      <div className={`text-xs font-semibold uppercase text-center ${i === 0 ? "text-yellow-500" : "text-role"}`}>
                        {buyer}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-end">
                      <div className="text-right mr-2">
                        <div className="text-sm font-bold">₹{Number(price).toLocaleString()}</div>
                        <div className="text-[11px] text-muted">Cr</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-center py-8 text-sm text-muted">
              No players to show
              <div className="text-xs text-slate-400 mt-2">{debugHint}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 px-4 py-3 border-t border-base-200 bg-base-100">
          <div className="text-xs text-muted">Tip: Click a player to view details or prepare a bid.</div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                document.getElementById("topPaidModal")?.close();
                onClose();
              }}
            >
              Close
            </button>
          </div>
        </footer>
      </div>

      {/* Backdrop */}
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close backdrop" />
      </form>
    </dialog>
  );
}
