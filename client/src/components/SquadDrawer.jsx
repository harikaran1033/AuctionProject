/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  // positions is an array of objects or nulls length 11 representing XI slots 1..11
  const [positions, setPositions] = useState(() => Array(11).fill(null));
  // meta for each assigned slot: { playerName, price, role, nation, isCaptain, isVC }
  const [selectedPos, setSelectedPos] = useState(null);

  useEffect(() => {
    // keep positions in sync if team shrinks/changes: remove assignments of players not in team
    setPositions((prev) =>
      prev.map((slot) => {
        if (!slot) return null;
        const exists = team.find((p) => p.name === slot.playerName);
        return exists ? slot : null;
      })
    );
  }, [team]);

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

  // Helpers for editor
  const openEditor = () => {
    // toggle edit mode (open inside drawer)
    setIsEditOpen(true);
  };

  const closeEditor = () => {
    setSelectedPos(null);
    setIsEditOpen(false);
  };

  const resetPositions = () => setPositions(Array(11).fill(null));

  const assignPlayerToSelected = (player) => {
    // if no selected position, choose first free slot (index 0..10)
    let posIndex = selectedPos;
    if (posIndex === null) {
      posIndex = positions.findIndex((s) => s === null);
      if (posIndex === -1) return; // no free slot
    }

    setPositions((prev) => {
      const newPos = [...prev];
      const current = newPos[posIndex];
      // if clicking same player toggles off
      if (current && current.playerName === player.name) {
        newPos[posIndex] = null;
        return newPos;
      }

      // Prevent duplicate player assigned to two slots: remove from other slots first
      for (let i = 0; i < newPos.length; i++) {
        if (newPos[i] && newPos[i].playerName === player.name) {
          newPos[i] = null;
        }
      }

      newPos[posIndex] = {
        playerName: player.name,
        price: player.price,
        role: player.role,
        nation: player.nation,
        isCaptain: false,
        isVC: false,
      };

      return newPos;
    });
  };

  const toggleCaptain = (index) => {
    setPositions((prev) => {
      const newPos = prev.map((p, i) => {
        if (!p) return p;
        // only one captain allowed -> toggle this one, unset others
        if (i === index) return { ...p, isCaptain: !p.isCaptain };
        return { ...p, isCaptain: false };
      });
      return newPos;
    });
  };

  const toggleVC = (index) => {
    setPositions((prev) => {
      const newPos = [...prev];
      if (!newPos[index]) return newPos;
      newPos[index] = { ...newPos[index], isVC: !newPos[index].isVC };
      return newPos;
    });
  };

  const removeFromPosition = (index) => {
    setPositions((prev) => {
      const newPos = [...prev];
      newPos[index] = null;
      return newPos;
    });
  };

const copyTeam = async () => {
  try {
    let textToCopy;
    if (isEditOpen) {
      // Build a numbered, human readable list from positions
      const lines = positions
        .map((p, i) => {
          if (!p) return null;
          const pos = i + 1;
          const name = formatName(p.playerName);
          const role = p.role || "";
          // show (c) or (vc) in lowercase as requested
          const flag = p.isCaptain ? " (c)" : p.isVC ? " (vc)" : "";
          return `${pos}. ${name} - ${role}${flag}`;
        })
        .filter(Boolean);
      textToCopy = lines.join("\n");
    } else {
      // keep original behaviour in normal mode (JSON)
      textToCopy = JSON.stringify(
        team.map((p) => ({ name: p.name, price: p.price, role: p.role })),
        null,
        2
      );
    }

    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  } catch (e) {
    // noop
  }
};


  const playersByRole = useMemo(() => {
    const map = {};
    roles.forEach((r) => (map[r] = team.filter((p) => String(p.role || "").toLowerCase() === r.toLowerCase())));
    return map;
  }, [team]);

  return (
    <div className="absolute right-4 top-4 font-body font-semibold drawer z-50">
      <input id="my-drawer-1" type="checkbox" className="drawer-toggle" />

      <div className="drawer-side">
        <label htmlFor="my-drawer-1" className="drawer-overlay"></label>

        <div className="menu bg-bg text-white min-h-full w-80 p-4 border-l border-border relative">
          {/* Header */}
          <div className="flex justify-between items-center mb-3 border-b border-border pb-2">
            <h4 className="text-lg font-semibold text-role uppercase tracking-wide">Your Squad</h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (isEditOpen ? closeEditor() : openEditor())}
                className="btn btn-ghost btn-sm text-sm"
                title={isEditOpen ? "Back to Squad" : "Edit XI"}
              >
                {isEditOpen ? "Squad" : "Edit Squad"}
              </button>
              <label htmlFor="my-drawer-1" className="cursor-pointer hover:text-playerName transition-colors text-base">
                ✕
              </label>
            </div>
          </div>

          {/* Scrollable Content - toggles between edit view and normal squad view */}
          <div className="max-h-[68vh] overflow-y-auto pr-1 custom-scrollbar space-y-2">
            {isEditOpen ? (
              // EDIT MODE: XI editor inside the drawer
              <div className="space-y-3">
                <div className="bg-card rounded-lg p-2 border border-border/60 transition-all duration-200">
                  <div className="flex justify-between items-center mb-1">
                    <h5 className="text-player font-semibold text-[11px] uppercase tracking-wide">Your XI</h5>
                    <span className="text-[10px] text-mute">Click a slot then assign a player</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">

                    {positions.map((slot, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedPos(idx)}
                        className={`p-2 rounded-md border min-h-[64px] cursor-pointer relative ${
                          selectedPos === idx ? "border-player/80 shadow" : "border-border/40"
                        }`}
                      >
                        <div className="text-xs text-mute">#{idx + 1}</div>
                        {slot ? (
                          <div className="mt-1">
                            {/* only show name inside the slot */}
                            <div className="font-medium">{formatName(slot.playerName)}</div>

                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleCaptain(idx); }}
                                className={`text-[11px] btn btn-ghost btn-xs ${slot.isCaptain ? "btn-active" : ""}`}
                                title="Toggle Captain"
                              >
                                C
                              </button>

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleVC(idx); }}
                                className={`text-[11px] btn btn-ghost btn-xs ${slot.isVC ? "btn-active" : ""}`}
                                title="Toggle Vice-Captain"
                              >
                                VC
                              </button>

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeFromPosition(idx); }}
                                className="text-[11px] btn btn-ghost btn-xs"
                                title="Remove from slot"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-mute">Empty</div>
                        )}

                        {slot && (
                          <div className="absolute top-2 right-2 text-[10px] text-white/60">
                            {slot.isCaptain ? "C" : slot.isVC ? "VC" : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setSelectedPos(null)} className="btn btn-sm">Clear Selection</button>
                    <button type="button" onClick={resetPositions} className="btn btn-sm btn-outline">Reset XI</button>
                    <div className="text-sm text-mute">{selectedPos !== null ? `Selected: #${selectedPos + 1}` : "No position selected"}</div>
                  </div>
                </div>

                <div className="bg-card rounded-lg p-2 border border-border/60 transition-all duration-200">
                  <div className="flex justify-between items-center mb-1">
                    <h5 className="text-player font-semibold text-[11px] uppercase tracking-wide">Squad</h5>
                    <span className="text-[10px] text-mute">Tap a player to assign to selected slot</span>
                  </div>

                  <div className="h-[240px] overflow-y-auto pr-2 space-y-2">
                    {team.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{formatName(p.name)}</div>
                          <div className="text-xs text-mute">{p.role}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs">₹{p.price} Cr</div>
                          <button
                            type="button"
                            onClick={() => assignPlayerToSelected(p)}
                            className="btn btn-xs"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // NORMAL MODE: grouped squad lists
              <>
                {roles.map((role) => {
                  const players = playersByRole[role] || [];
                  if (players.length === 0) return null;

                  return (
                    <div key={role} className="bg-card rounded-lg p-2 border border-border/60 hover:border-player/60 transition-all duration-200">
                      <div className="flex justify-between items-center mb-1">
                        <h5 className="text-player  font-semibold text-[11px] uppercase tracking-wide">{role}s</h5>
                        <span className="text-[10px] text-mute">{players.length}</span>
                      </div>

                      <ul className="divide-y divide-border/40 text-[13px] font-medium">
                        {players.map((p, i) => (
                          <li key={i} className="flex justify-between items-center py-1 flex-row">
                            <div className="flex items-center gap-1">
                              <span className="text-white">{formatName(p.name)}</span>
                              {isForeign(room.dataset, p.nation) && (
                                <span className="text-white/40 text-[11px]" title={`${p.nation} Player`}>✈</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-bid text-highlight font-semibold text-[12px]">₹{p.price} Cr</span>
                              <button
                                type="button"
                                onClick={() => assignPlayerToSelected(p)}
                                className="btn btn-xs btn-outline"
                                title="Assign to selected slot (or first empty)"
                              >
                                Assign
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer Summary */}
          <div className="fixed bottom-5 left-4 right-4 bg-card1 rounded-lg p-3 border border-border/70">
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
                onClick={copyTeam}
                className="btn btn-primary btn-sm w-full rounded-md border-none font-semibold bg-currentBid text-black hover:bg-currentBid/90 transition-all duration-200"
              >
                {copied ? "Copied ✓" : isEditOpen ? "Copy XI" : "Copy Team"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
