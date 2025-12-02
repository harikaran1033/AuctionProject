/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/* helpers (keeps your safe() behavior but treats 0 as valid) */
const safe = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));

/* stronger pick: case-insensitive and tolerant */
const pick = (obj, ...keys) => {
  if (!obj || typeof obj !== "object") return undefined;
  const props = Object.keys(obj);
  const mapLower = props.reduce((m, k) => {
    m[k.toLowerCase()] = k;
    return m;
  }, {});
  for (const k of keys) {
    if (k === null || k === undefined) continue;
    // try exact first
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
    // try lowercase match
    const low = String(k).toLowerCase();
    if (mapLower[low]) return obj[mapLower[low]];
    // try normalized match (remove punctuation)
    const norm = String(k).replace(/[^a-z0-9]/gi, "").toLowerCase();
    for (const p of props) {
      if (p.replace(/[^a-z0-9]/gi, "").toLowerCase() === norm) return obj[p];
    }
  }
  return undefined;
};

const fifties100s = (batting = {}) => {
  const v1 = pick(batting, "50s/100s", "50s100s");
  if (v1) return v1;
  const fifties = pick(batting, "50", "50s");
  const hundreds = pick(batting, "100", "100s");
  if (fifties !== undefined || hundreds !== undefined)
    return `${safe(fifties ?? "-")} / ${safe(hundreds ?? "-")}`;
  const hi = pick(batting, "Hi", "HI", "high", "best");
  if (hi) return hi;
  return "-";
};
const fourFiveW = (bowling = {}) => {
  const v1 = pick(bowling, "4w/5w", "4W/5W", "4w5w", "4w_5w");
  if (v1) return v1;
  const f4 = pick(bowling, "4W", "4w", "4");
  const f5 = pick(bowling, "5W", "5w", "5");
  if (f4 !== undefined || f5 !== undefined) return `${safe(f4 ?? "-")} / ${safe(f5 ?? "-")}`;
  return "-";
};

const containerVars = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.18 } } };

// small helpers to parse style strings (unchanged)
const primaryStyle = (s) => {
  if (!s) return "";
  const parts = String(s).split(",").map((p) => p.trim()).filter(Boolean);
  return parts[0] ?? "";
};
const remainingStyle = (s) => {
  if (!s) return "";
  const parts = String(s).split(",").map((p) => p.trim()).filter(Boolean);
  return parts.slice(1).join(", ");
};

// AnimatedNumber: animates numeric strings on mount/change. Non-numeric values are rendered as-is.
function AnimatedNumber({ value, duration = 800, decimals = null }) {
  // value: string or number
  const raw = value ?? "-";
  const str = String(raw).trim();

  // detect plain numeric string (optionally with commas)
  const numericMatch = str.match(/^(-?\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?$/);
  if (!numericMatch) {
    // not a clean number -> just render safely
    return <div className="text-sm font-semibold text-white tabular-nums">{safe(raw)}</div>;
  }

  // parse target and decide formatting
  const integerPart = numericMatch[1].replace(/,/g, "");
  const fraction = numericMatch[2] ?? null;
  const target = parseFloat(`${integerPart}${fraction ? '.' + fraction : ''}`);
  const precision = decimals ?? (fraction ? fraction.length : 0);

  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 120, damping: 20, mass: 1 });
  const [display, setDisplay] = useState(() => {
    // show 0 initially (or preserve initial if you prefer)
    return precision > 0 ? (0).toFixed(precision) : String(0);
  });

  useEffect(() => {
    // start animation to target on mount / when target changes
    mv.set(target);
    const unsubscribe = spring.on('change', (v) => {
      if (precision > 0) setDisplay(Number(v).toFixed(precision));
      else setDisplay(String(Math.round(v)));
    });
    return () => unsubscribe();
  }, [target, precision]);

  // optional: show commas for thousands for integers
  const formatted = () => {
    if (precision > 0) {
      // keep decimals as fixed, but format integer part with commas
      const parts = display.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }
    return display.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return <div className="text-sm font-semibold text-white tabular-nums">{formatted()}</div>;
}

export default function PlayerStats({ player = {} }) {
  // keep the last non-empty player to avoid flash-of-empty on initial mount
  const [lastKnown, setLastKnown] = useState(() => (player && Object.keys(player).length ? player : null));
  useEffect(() => {
    if (player && Object.keys(player).length) setLastKnown(player);
  }, [player]);

  // determine displayPlayer: prefer full incoming player when non-empty, otherwise lastKnown
  const display = (player && Object.keys(player).length) ? player : lastKnown;

  // --- derive data (these are plain values, safe to compute before early returns) ---
  const stats = display?.stats ?? display?.STATS ?? {};
  const Batting = stats?.Batting ?? stats?.batting ?? stats?.Bat ?? null;
  const Bowling = stats?.Bowling ?? stats?.bowling ?? stats?.Bowl ?? null;

  const bestBatting =
    display?.BEST_BATTING ?? display?.bestBatting ?? display?.best_batting ?? pick(Batting, "Hi", "HI", "high", "best") ?? null;
  const bestBowling =
    display?.BEST_BOWLING ?? display?.bestBowling ?? display?.best_bowling ?? pick(Bowling, "Best", "BEST", "best", "BEST_BOWLING") ?? null;
  const genericBest = display?.BEST ?? display?.best ?? null;

  const battingAvgRaw = pick(Batting, "Avg", "AVG", "average");
  const bowlingAvgRaw = pick(Bowling, "Avg", "AVG", "average");
  const battingAvg = battingAvgRaw != null ? safe(battingAvgRaw) : "-";
  const bowlingAvg = bowlingAvgRaw != null ? safe(bowlingAvgRaw) : "-";

  const playerType = display?.player_type ?? display?.playerType ?? display?.PLAYER_TYPE ?? display?.type ?? "";
  const isAllRounder = /all|round/i.test(playerType) || (Batting && Bowling);

  const innings = pick(Batting, "I", "Inn", "Inns") ?? pick(Bowling, "I", "Inn", "Inns") ?? display?.innings ?? display?.Inns ?? "-";

  const runs = safe(pick(Batting, "R", "Runs", "runs"));
  const wkts = safe(pick(Bowling, "W", "Wkts", "Wickets"));
  const sr = safe(pick(Batting, "SR", "sr", "StrikeRate"));
  const econ = safe(pick(Bowling, "Econ", "econ", "ER"));

  const styleRaw = display?.PLAYER_STYLE ?? display?.playerStyle ?? "";
  const primary = primaryStyle(styleRaw);
  const extras = remainingStyle(styleRaw);
  const nation = display?.NATION ?? display?.nation ?? display?.country ?? "";

  // Debug hook: moved *before* any early return so hooks order is stable.
  useEffect(() => {
    if (!Batting && !Bowling) {
      // only warn if some fields actually exist on parent but stats not found
      if (display && (display.stats || display.STATS)) {
        // eslint-disable-next-line no-console
        console.warn("[PlayerStats] stats object exists but no Batting/Bowling keys found", display.stats ?? display.STATS);
      }
    }
  }, [display, Batting, Bowling]);

  // If we have nothing at all yet, show a lightweight loading placeholder (instead of a grid of "-")
  const isEmpty = !display || Object.keys(display).length === 0;
  if (isEmpty) {
    return (
      <motion.div variants={containerVars} initial="hidden" animate="visible" className="w-full">
        <div className="bg-black p-3 shadow-md border border-outline rounded-xl">
          <div className="animate-pulse w-full h-14 rounded-md bg-white/6" />
          <div className="mt-3 grid grid-cols-4 gap-2">
            <div className="h-12 bg-white/6 rounded-md" />
            <div className="h-12 bg-white/6 rounded-md" />
            <div className="h-12 bg-white/6 rounded-md" />
            <div className="h-12 bg-white/6 rounded-md" />
          </div>
        </div>
      </motion.div>
    );
  }

  // Continue with rendering using 'display'
  let entries;
  if (isAllRounder) {
    entries = [
      ["Runs", runs],
      ["Bat Avg", battingAvg],
      ["Wkts", wkts],
      ["Bowl Avg", bowlingAvg],
    ];
  } else if (Batting) {
    entries = [
      ["Runs", runs],
      ["Avg", battingAvg],
      ["SR", sr],
      ["50s/100s", fifties100s(Batting)],
    ];
  } else if (Bowling) {
    entries = [
      ["Wkts", wkts],
      ["Avg", bowlingAvg],
      ["Eco", econ],
      ["4/5w", fourFiveW(Bowling)],
    ];
  } else {
    entries = [["-", "-"], ["-", "-"], ["-", "-"], ["-", "-"]];
  }

  const showBestBat = (isAllRounder || Batting) && (bestBatting ?? genericBest);
  const showBestBowl = (isAllRounder || Bowling) && (bestBowling ?? genericBest);

  const initials =
    String(display?.NAME ?? display?.name ?? "")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <motion.div variants={containerVars} initial="hidden" animate="visible" className="w-full">
      <div className="bg-black p-3 shadow-md border border-outline rounded-xl">
        {/* header */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-emerald-500 truncate">
                  {display?.TEAM ?? display?.team ?? "-"} • <span className="font-medium">{display?.ROLE ?? display?.role ?? "-"}</span>
                </div>
              </div>

              {/* player type chip */}
              {playerType ? (
                <div className="inline-flex items-center gap-2 bg-white/6 px-2 py-1 rounded-md text-[12px] text-muted">
                  <div className="uppercase text-[11px] font-medium">Type</div>
                  <div className="font-semibold text-neon text-xs">{safe(playerType)}</div>
                </div>
              ) : null}
            </div>

            {/* metadata row */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm justify-between">
              <div className="inline-flex items-center gap-2 text-[13px] text-muted">
                <Star className="w-4 h-4 text-yellow-400" />
                <div>
                  <div className="text-[11px] text-org">Inns</div>
                  <div className="font-semibold text-white tabular-nums">{innings}</div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 font-body">
                {showBestBat && (
                  <div className="inline-flex items-center gap-2 bg-sky-600/12 px-2 py-1 rounded-md">
                    <div className="text-[11px] text-sky-600 font-medium">Bat</div>
                    <div className=" tabular-nums text-white text-xs">{safe(bestBatting ?? genericBest)}</div>
                  </div>
                )}
                {showBestBowl && (
                  <div className="inline-flex items-center gap-2 bg-emerald-600/12 px-2 py-1 rounded-md">
                    <div className="text-[11px] text-emerald-600 font-medium">Bowl</div>
                    <div className="text-xs text-white tabular-nums">{safe(bestBowling ?? genericBest)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* stats grid */}
        <div className="mt-3 grid grid-cols-4 sm:grid-cols-4 gap-2">
          {entries.slice(0, 4).map(([k, v]) => (
            <div key={k} className="bg-white/6 rounded-md px-3 py-2 flex flex-col">
              {/* use AnimatedNumber for numeric values */}
              <AnimatedNumber value={v} />
              <div className="text-[10px] text-muted uppercase tracking-wide mt-1">{k}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
