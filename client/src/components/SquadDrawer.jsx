/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import React, { useState } from "react";
import { isForeign, getIncrement } from "../utils/players";


export default function SquadDrawer({
  team = [],
  room = {},
  remainingBudget = 0,
  totalPlayersPerTeam = 0,
  bid = 0,
  bidder = null,
}) {
  const [copied, setCopied] = useState(false);

  const roles = ["Batter", "Bowler", "All-Rounder", "WK-Batter"];

  const formatName = (n) =>
    String(n || "")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const foreignCount = team.filter((p) => isForeign(room?.dataset, p.nation)).length;

  const nextMinBid = (() => {
    const current = Number(bid || 0);
    const inc = getIncrement(current);
    const next = bidder ? current + inc : current;
    return Number(next).toFixed(2);
  })();

  const handleCopy = async () => {
    try {
      const payload = team.map((p) => ({ name: p.name, price: p.price }));
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {}
  };

  return (
    <div className="absolute right-4 top-4 font-body font-semibold drawer z-50">
      <input id="my-drawer-1" type="checkbox" className="drawer-toggle" />

      <div className="drawer-side">
        <label htmlFor="my-drawer-1" className="drawer-overlay"></label>

        <div className="menu bg-bg text-white min-h-full w-80 p-4 border-l border-border relative">
          {/* Header */}
          <div className="flex justify-between items-center mb-3 border-b border-border pb-2">
            <h4 className="text-lg font-semibold text-role uppercase tracking-wide">Your Squad</h4>
            <label htmlFor="my-drawer-1" className="cursor-pointer hover:text-playerName transition-colors text-base">
              ✕
            </label>
          </div>

          {/* Scrollable Content */}
          <div className="max-h-[68vh] overflow-y-auto pr-1 custom-scrollbar space-y-2">
            {roles.map((role) => {
              const playersByRole = team.filter(
                (p) => String(p.role || "").toLowerCase() === role.toLowerCase()
              );
              if (playersByRole.length === 0) return null;

              return (
                <div key={role} className="bg-card rounded-lg p-2 border border-border/60 hover:border-player/60 transition-all duration-200">
                  <div className="flex justify-between items-center mb-1">
                    <h5 className="text-player  font-semibold text-[11px] uppercase tracking-wide">{role}s</h5>
                    <span className="text-[10px] text-mute">{playersByRole.length}</span>
                  </div>

                  <ul className="divide-y divide-border/40 text-[13px] font-medium">
                    {playersByRole.map((p, i) => {
                      const foreign = isForeign(room.dataset, p.nation);
                      return (
                        <li key={i} className="flex justify-between items-center py-1 flex-row">
                          <div className="flex items-center gap-1">
                            <span className="text-white">{formatName(p.name)}</span>
                            {foreign && <span className="text-white/40 text-[11px]" title={`${p.nation} Player`}>✈</span>}
                          </div>
                          <span className="text-bid text-highlight font-semibold text-[12px]">₹{p.price} Cr</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Footer Summary */}
          <div className="absolute bottom-5 left-4 right-4 bg-card1 rounded-lg p-3 border border-border/70">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-mute">Remaining Budget</p>
                <p className="text-role font-semibold">₹{Number(remainingBudget).toFixed(2)} Cr</p>
              </div>

              <div>
                <p className="text-sm text-mute">Spots Filled</p>
                <p className="text-playerName font-semibold">{team.length} / {totalPlayersPerTeam}</p>
              </div>

              <div>
                <p className="text-sm text-mute">Foreign Slots</p>
                <p className="text-role font-semibold">
                  {typeof room?.maxForeignPlayers === "number" ? (
                    <>
                      {foreignCount} / {room.maxForeignPlayers}
                    </>
                  ) : (
                    <>—</>
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm text-mute">Next min bid</p>
                <p className="text-playerName font-semibold">₹{nextMinBid} Cr</p>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopy}
                className="btn btn-primary btn-sm w-full rounded-md border-none font-semibold bg-currentBid text-black hover:bg-currentBid/90 transition-all duration-200"
              >
                {copied ? "Copied ✓" : "Copy Team"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}