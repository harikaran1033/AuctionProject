/* eslint-disable no-unused-vars */
/* OtherBudgetsModal — modern card UI for all screens
   - Single unified card for all breakpoints (no dialog)
   - Each team shown as its own elevated card
   - Glowing, gradient RoundBar with subtle drop shadow
   - Logic and data handling unchanged
*/
import React, { useMemo, useState } from "react";

export default function OtherBudgetsModal({ room, playerName = "", totalPlayersPerTeam = 11 }) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("budget_desc");

  const qNorm = (q || "").trim().toLowerCase();

  // safe text converter to avoid rendering raw objects
  const safeText = (v) => {
    if (v === null || v === undefined) return "-";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    try {
      const s = JSON.stringify(v);
      return s.length > 120 ? s.slice(0, 117) + "…" : s;
    } catch {
      return String(v);
    }
  };

  // isForeign helper (same logic you had)
  const isForeign = (dataset, nation) => {
    if (!nation) return false;
    if (!dataset) return false;

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

  // Modern glowing RoundBar (uses gradient stroke and svg filter for glow)
  const RoundBar = ({
    idSuffix = "r",
    size = 56,
    stroke = 6,
    value = 0,
    max = 100,
    innerLabel = "",
    bottomLabel = "",
    colorFrom = "#06b6d4",
    colorTo = "#7c3aed",
    inactiveColor = "rgba(148,163,184,0.18)",
    active = true,
  }) => {
    const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;
    const gradId = `g-${idSuffix}`;
    const glowId = `glow-${idSuffix}`;
    const fontSize = Math.max(11, Math.floor(size / 4));

    return (
      <div className="flex flex-col items-center select-none">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-[0_6px_12px_rgba(124,58,237,0.18)]">
          <defs>
            <linearGradient id={gradId} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor={colorFrom} />
              <stop offset="100%" stopColor={colorTo} />
            </linearGradient>

            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            stroke={inactiveColor}
            fill="transparent"
            opacity={0.9}
          />

          {/* Progress ring (gradient) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={active ? `url(#${gradId})` : inactiveColor}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={active ? { filter: `url(#${glowId})` } : {}}
          />

          {/* Center text */}
          <text
            x="50%"
            y="46%"
            dominantBaseline="middle"
            textAnchor="middle"
            style={{
              fontSize,
              fontWeight: 800,
              fill: active ? (colorTo ?? colorFrom) : "#94a3b8",
            }}
          >
            {innerLabel}
          </text>
        </svg>

        <div className="mt-1 text-[11px] text-slate-300 text-center leading-tight w-20">{bottomLabel}</div>
      </div>
    );
  };

  const visiblePlayers = useMemo(() => {
    const players = Array.isArray(room?.players) ? room.players : [];
    const filteredByName = players.filter((p) => (p?.name || "").toLowerCase() !== (playerName || "").toLowerCase());

    const filtered = filteredByName.filter((p) => {
      if (!qNorm) return true;
      const name = (p?.name || "").toString().toLowerCase();
      const teamName = (p?.teamName ?? p?.team ?? p?.club ?? "").toString().toLowerCase();
      return name.includes(qNorm) || teamName.includes(qNorm);
    });

    const withMeta = filtered.map((p) => {
      const teamCount = Array.isArray(p?.team) ? p.team.length : Number(p?.teamCount ?? 0);
      const budget = Number(p?.budget ?? 0);

      // compute foreign count for that team (if team array provided use nations)
      let foreignCount = 0;
      if (Array.isArray(p?.team)) {
        foreignCount = p.team.filter((m) => m && m.nation && isForeign(room?.dataset, m.nation)).length;
      } else {
        foreignCount = Number(p?.foreignCount ?? 0);
      }

      return { raw: p, teamCount, budget, foreignCount };
    });

    withMeta.sort((a, b) => {
      switch (sortBy) {
        case "budget_desc":
          return b.budget - a.budget;
        case "budget_asc":
          return a.budget - b.budget;
        case "name_asc": {
          const an = (a.raw.name || "").toLowerCase();
          const bn = (b.raw.name || "").toLowerCase();
          return an.localeCompare(bn);
        }
        case "squad_desc":
          return (b.teamCount || 0) - (a.teamCount || 0);
        default:
          return 0;
      }
    });

    return withMeta.map((m) => ({ ...m.raw, teamCount: m.teamCount, __budgetNum: m.budget, __foreignCount: m.foreignCount }));
  }, [room?.players, playerName, qNorm, sortBy, room?.dataset]);

  const copySnapshot = () => {
    try {
      const snapshot = visiblePlayers.map((p) => ({
        name: safeText(p.name),
        budget: Number(p.budget ?? 0).toFixed(2),
        teamCount: Array.isArray(p.team) ? p.team.length : p.teamCount ?? 0,
        teamName: safeText(p.teamName ?? p.team ?? p.club ?? ""),
        foreignCount: p.__foreignCount ?? 0,
      }));
      navigator.clipboard?.writeText(JSON.stringify(snapshot, null, 2));
    } catch (e) {
      // noop
    }
  };

  return (
   <dialog id="otherBudgetsModal" className="modal">
  <div className="modal-box w-full max-w-4xl p-0 bg-[#071426] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

    {/* HEADER */}
    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
      <div>
        <h3 className="text-xl font-bold text-white">Other Teams · Budgets</h3>
        <p className="text-xs text-slate-400">Compare squads & budgets instantly</p>
      </div>

      <button
        className="btn btn-sm btn-ghost"
        onClick={() => document.getElementById("otherBudgetsModal")?.close()}
      >
        ✕
      </button>
    </div>

    {/* SEARCH + SORT */}
    <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-3">
      <input
        id="budgetsSearch"
        type="search"
        placeholder="Search team or owner..."
        className="input input-sm input-bordered w-full sm:w-1/2"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="flex gap-2 ml-auto">
        <select
          className="select select-sm select-bordered"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="budget_desc">Budget High → Low</option>
          <option value="budget_asc">Budget Low → High</option>
          <option value="name_asc">Name A → Z</option>
          <option value="squad_desc">Squad Filled</option>
        </select>

        <button className="btn btn-sm btn-primary" onClick={copySnapshot}>Copy</button>
      </div>
    </div>

    {/* TEAM CARDS */}
    <div className="p-4 max-h-[65vh] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
      {visiblePlayers.length === 0 ? (
        <div className="col-span-full text-center py-6 text-slate-400">
          No teams match your search
        </div>
      ) : (
        visiblePlayers.map((p, idx) => {
          const teamCount = Array.isArray(p.team) ? p.team.length : p.teamCount ?? 0;
          const fillPct = Math.round((teamCount / totalPlayersPerTeam) * 100);
          const foreignCount = p.__foreignCount ?? 0;
          const foreignPct = Math.round((foreignCount / (room?.maxForeignPlayers || 4)) * 100);
          const budgetNum = Number(p.budget ?? p.__budgetNum ?? 0);
          const remaining = totalPlayersPerTeam - teamCount;
          const minBidText = remaining > 0 ? `₹${(budgetNum / remaining).toFixed(2)} Cr` : "—";
          const nameText = safeText(p.name);
          const teamLabel = safeText(p.teamName ?? p.club ?? "");

          return (
            <div
              key={idx}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4 items-center 
              hover:bg-white/10 transition cursor-default shadow-lg"
            >
              {/* LEFT — USER AVATAR + NAME */}
              <div className="flex items-center gap-3 min-w-0">

                <div className="min-w-0">
                  <div className="text-white font-semibold truncate font-body">{nameText}</div>
                  <div className="text-xs text-slate-400 truncate">{teamLabel}</div>
                </div>
              </div>

              {/* RIGHT — METRICS */}
              <div className="ml-auto flex gap-4 items-center">
                {/* 💠 Squad RoundBar */}
                <RoundBar
                  idSuffix={`s-${idx}`}
                  size={64}
                  stroke={6}
                  value={fillPct}
                  max={100}
                  innerLabel={`${fillPct}%`}
                  bottomLabel={`${teamCount}/${totalPlayersPerTeam}`}
                  colorFrom="#06b6d4"
                  colorTo="#3b82f6"
                  active={true}
                />

                {/* 🔥 Foreign RoundBar */}
                <RoundBar
                  idSuffix={`f-${idx}`}
                  size={64}
                  stroke={6}
                  value={foreignPct}
                  max={100}
                  innerLabel={`${foreignCount}`}
                  bottomLabel={`Foreign`}
                  colorFrom="#f97316"
                  colorTo="#ef4444"
                  active={true}
                />

                {/* 💰 Budget */}
                <div className="text-right">
                  <div className="text-sm font-bold text-white">₹{budgetNum.toFixed(2)} Cr</div>
                  <div className="text-[11px] text-slate-400">Available</div>
                  <div className="mt-1 text-[11px] text-slate-300">{minBidText}</div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>

    {/* FOOTER */}
    <div className="p-4 border-t border-white/10 flex justify-between">
      <p className="text-xs text-slate-400">Tip: Use search before you bid.</p>
      <button className="btn btn-sm btn-ghost" onClick={() => document.getElementById("budgetsSearch")?.focus()}>
        Focus Search
      </button>
    </div>
  </div>

  <form method="dialog" className="modal-backdrop"><button /></form>
</dialog>

  );
}
