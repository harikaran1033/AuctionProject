/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useSpring } from "framer-motion";

/**
 * LiveBidBox — rising-only stems + roomy spacing + modern UI polish
 * - shows vertical stems only for points that increased vs previous point
 * - uses roomy spacing between stems for clarity
 * - modernized visuals: softer gradients, rounded card, subtle shadow, micro-animations
 */

function AnimatedNumber({ value = 0, decimals = 2 }) {
  const spring = useSpring(Number(value) || 0, { stiffness: 200, damping: 28 });
  const [display, setDisplay] = useState(Number(value) || 0);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Number(v)));
    return () => unsub && unsub();
  }, [spring]);

  useEffect(() => {
    spring.set(Number(value) || 0);
  }, [value, spring]);

  const nf = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals]
  );
  return <>{nf.format(display)}</>;
}

const TYPE_ACCENT = {
  request: "from-amber-400",
  declined: "from-rose-400",
  accepted: "from-emerald-300",
  executed: "from-sky-300",
  updated: "from-zinc-400",
};

export default function LiveBidBox({
  bid = 0,
  bidder = "",
  initialHistory = [],
  ownerName = "",
  maxPoints = 24,
  socket = null,
  onOpenTrades = () => {},
  roomId = null,
  step = 0.5, // value grid step
}) {
  const storageKey = roomId ? `livebid_history::${roomId}` : `livebid_history::global`;

  const [history, setHistory] = useState(() => {
    const start = Array.isArray(initialHistory) ? initialHistory.slice(-maxPoints) : [];
    if (start.length) return start;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey)) || null;
      if (Array.isArray(saved) && saved.length) return saved.slice(-maxPoints);
    } catch (e) {}
    if (typeof bid === "number") {
      const fillCount = Math.min(maxPoints, 4);
      return new Array(fillCount).fill(bid);
    }
    return [];
  });

  const prevRoomRef = useRef(roomId);
  useEffect(() => {
    if (roomId && prevRoomRef.current !== roomId) {
      setHistory((_) => (typeof bid === "number" ? [bid] : []));
      prevRoomRef.current = roomId;
    }
  }, [roomId, bid]);

  const prevBidRef = useRef(bid);
  const [delta, setDelta] = useState(0);
  const [showDelta, setShowDelta] = useState(false);

  useEffect(() => {
    const prev = prevBidRef.current ?? 0;
    if (typeof bid !== "number") return;
    if (bid > prev) {
      const inc = +(bid - prev).toFixed(2);
      setDelta(inc);
      setShowDelta(true);
      setHistory((h) => [...h.slice(-maxPoints + 1), bid]);
      const t = setTimeout(() => setShowDelta(false), 900);
      prevBidRef.current = bid;
      return () => clearTimeout(t);
    }
    prevBidRef.current = bid;
  }, [bid, maxPoints]);

  useEffect(() => {
    if (!history.length && typeof bid === "number") setHistory([bid]);
  }, []);

  useEffect(() => {
    try {
      if (history && history.length)
        localStorage.setItem(storageKey, JSON.stringify(history.slice(-maxPoints)));
    } catch (e) {}
  }, [history, maxPoints, storageKey]);

  useEffect(() => {
    if (typeof bid === "number") {
      const last = history[history.length - 1];
      if (last !== bid) {
        const fillCount = Math.min(maxPoints, Math.max(2, Math.floor(maxPoints / 6)));
        const newHist = new Array(fillCount).fill(bid);
        setHistory((h) => [...h.slice(-maxPoints + newHist.length), ...newHist]);
        prevBidRef.current = bid;
      }
    }
  }, [bid]);

  // bigger SVG with roomy spacing between stems
  const svgW = 220;
  const svgH = 48;

  // map history to points; we intentionally put points in roomy slots
  const pts = useMemo(() => {
    if (!history.length) return [];
    const arr = history.slice(-maxPoints);
    const maxV = Math.max(...arr, bid);
    const minV = Math.min(...arr, bid);
    const pad = Math.max(step * 2, (maxV - minV) * 0.06 || step * 2);
    const max = maxV + pad;
    const min = Math.max(0, minV - pad);
    const valueRange = max === min ? 1 : max - min;

    // Friendly spacing: compute slotWidth and center points in each slot
    const slotCount = arr.length;
    const slotWidth = slotCount > 1 ? svgW / slotCount : svgW;

    return arr.map((v, i) => {
      const x = slotWidth * i + slotWidth / 2; // centered in its slot
      const y = ((max - v) / valueRange) * (svgH - 18) + 10; // leave margins
      // determine if this point is a rise vs previous value
      const prev = i > 0 ? arr[i - 1] : null;
      const isRise = prev !== null ? v > prev : false;
      return { x, y, v, isRise };
    });
  }, [history, maxPoints, svgW, svgH, step, bid]);

  // grid lines
  const grid = useMemo(() => {
    if (!pts.length) return { lines: [], min: 0, max: 0 };
    const values = pts.map((p) => p.v);
    const maxV = Math.max(...values, bid);
    const minV = Math.min(...values, bid);
    const pad = Math.max(step * 2, (maxV - minV) * 0.06 || step * 2);
    let top = Math.ceil((maxV + pad) / step) * step;
    let bottom = Math.floor(Math.max(0, minV - pad) / step) * step;
    if (bottom === top) {
      top = top + step * 2;
      bottom = Math.max(0, bottom - step);
    }
    const lines = [];
    for (let v = bottom; v <= top + 1e-9; v = Math.round((v + step) * 100) / 100) {
      lines.push(v);
      if (lines.length > 200) break;
    }
    return { lines, min: bottom, max: top };
  }, [pts, step, bid]);

  function valueToY(value) {
    if (!pts.length) return svgH / 2;
    const vals = pts.map((p) => p.v);
    const maxV = Math.max(...vals, bid);
    const minV = Math.min(...vals, bid);
    const pad = Math.max(step * 2, (maxV - minV) * 0.06 || step * 2);
    const max = maxV + pad;
    const min = Math.max(0, minV - pad);
    const valueRange = max === min ? 1 : max - min;
    return ((max - value) / valueRange) * (svgH - 18) + 10;
  }

  function buildSmoothPath(points) {
    if (!points.length) return "";
    if (points.length === 1) {
      const p = points[0];
      return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y}`;
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const cx = (prev.x + cur.x) / 2;
      const cy = (prev.y + cur.y) / 2;
      d += ` Q ${prev.x} ${prev.y} ${cx} ${cy}`;
    }
    const last = points[points.length - 1];
    d += ` T ${last.x} ${last.y}`;
    return d;
  }

  const pathD = useMemo(() => buildSmoothPath(pts), [pts]);
  const lastPoint = pts.length ? pts[pts.length - 1] : { x: 0, y: svgH / 2, v: bid };
  const dotX = useSpring(lastPoint.x, { stiffness: 200, damping: 30 });
  const dotY = useSpring(lastPoint.y, { stiffness: 200, damping: 30 });
  const [dotPos, setDotPos] = useState({ x: lastPoint.x, y: lastPoint.y });
  useEffect(() => {
    const ux = dotX.on("change", (x) => setDotPos((p) => ({ ...p, x })));
    const uy = dotY.on("change", (y) => setDotPos((p) => ({ ...p, y })));
    dotX.set(lastPoint.x);
    dotY.set(lastPoint.y);
    return () => {
      ux && ux();
      uy && uy();
    };
  }, [lastPoint.x, lastPoint.y, dotX, dotY]);

  // ticker (unchanged)
  const queueRef = useRef([]);
  const [activeNotice, setActiveNotice] = useState(null);
  const activeTimerRef = useRef(null);

  const enqueueNotice = (payload) => {
    queueRef.current.push(payload);
    if (!activeNotice) dequeueAndShow();
  };
  const dequeueAndShow = () => {
    if (queueRef.current.length === 0) {
      setActiveNotice(null);
      return;
    }
    const next = queueRef.current.shift();
    setActiveNotice(next);
    const dur = 1200;
    if (activeTimerRef.current) {
      clearTimeout(activeTimerRef.current);
      activeTimerRef.current = null;
    }
    activeTimerRef.current = setTimeout(() => {
      setActiveNotice(null);
      activeTimerRef.current = null;
      setTimeout(() => {
        if (queueRef.current.length) dequeueAndShow();
      }, 60);
    }, dur);
  };

  const showNotice = (noticeObj) => {
    if (!noticeObj) return;
    const to = String(noticeObj.to ?? noticeObj.owner ?? "").trim().toLowerCase();
    const mine = String(ownerName ?? "").trim().toLowerCase();
    if (to && to !== mine) return;

    const fromName = noticeObj.from || noticeObj.requester || noticeObj.fromName || noticeObj.owner || "Someone";
    const playerRequestedName = (noticeObj.playerRequested && (noticeObj.playerRequested.name ?? noticeObj.playerRequested)) || noticeObj.player || noticeObj.playerName || "";
    const type = noticeObj.type || noticeObj.eventType || (noticeObj.status === "accepted" ? "accepted" : "request");
    const message =
      noticeObj.message ||
      (type === "accepted" && `${fromName} accepted the trade.`) ||
      (type === "declined" && `${fromName} declined the trade.`) ||
      (type === "executed" && `${fromName} executed a trade.`) ||
      (type === "request" && (playerRequestedName ? `${fromName} requested ${playerRequestedName}` : `${fromName} sent a trade request`)) ||
      `${fromName} sent a trade update`;

    const payload = {
      raw: noticeObj,
      type,
      from: fromName,
      to: noticeObj.to || noticeObj.owner || "",
      playerRequestedName,
      message,
      ts: Date.now(),
      id: noticeObj._id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    enqueueNotice(payload);
  };

  useEffect(() => {
    const winHandler = (e) => {
      const d = e?.detail;
      if (!d) return;
      showNotice({ ...d, type: d.type || "request" });
    };
    window.addEventListener("live:trade-request-sent", winHandler);

    let incomingHandler = null,
      declinedHandler = null,
      executedHandler = null,
      updatedHandler = null;
    if (socket && typeof socket.on === "function") {
      incomingHandler = (payload) => showNotice({ ...payload, type: "request", eventType: "request" });
      declinedHandler = (payload) => showNotice({ ...payload, type: "declined", eventType: "declined" });
      executedHandler = (payload) => showNotice({ ...payload, type: "executed", eventType: "executed" });
      updatedHandler = (payload) => showNotice({ ...payload, type: payload.status === "accepted" ? "accepted" : payload.status || "updated", eventType: "updated" });

      socket.on("incoming-trade-request", incomingHandler);
      socket.on("trade-declined", declinedHandler);
      socket.on("trade-executed", executedHandler);
      socket.on("trade-request-updated", updatedHandler);
    }

    return () => {
      window.removeEventListener("live:trade-request-sent", winHandler);
      if (socket && typeof socket.off === "function") {
        if (incomingHandler) socket.off("incoming-trade-request", incomingHandler);
        if (declinedHandler) socket.off("trade-declined", declinedHandler);
        if (executedHandler) socket.off("trade-executed", executedHandler);
        if (updatedHandler) socket.off("trade-request-updated", updatedHandler);
      }
      if (activeTimerRef.current) {
        clearTimeout(activeTimerRef.current);
        activeTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, ownerName]);

  const openTrades = () => {
    try {
      onOpenTrades && onOpenTrades();
    } catch (err) {}
  };

  return (
    <div className="w-full flex flex-col sm:flex-row md:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-linear-to-b from-black/50 via-white/2 to-black/60 border border-white/6 shadow-lg backdrop-blur-md" role="status" aria-live="polite">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="inline-grid *:[grid-area:1/1]">
            <div className="status status-error animate-ping bg-red-500"></div>
            <div className="status status-error bg-red-500"></div>
          </div>
          <div className="text-xs font-semibold text-red-500 uppercase tracking-wide">Live</div>
        </div>

        <div className="min-w-0">
          <div className="text-sm font-extrabold text-white/90">
            <AnimatedNumber value={bid} decimals={2} /> cr
          </div>
          {bidder ? <div className="text-[12px] text-zinc-400 truncate max-w-[14rem]">{bidder}</div> : <p className="text-xs text-muted">BP</p>}
        </div>
      </div>

      {/* Center: roomy grid + rising-only stems */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-2">
        <div className="w-full max-w-[360px] rounded-lg p-1.5 bg-gradient-to-b from-white/3 to-black/5 border border-white/4 backdrop-blur-sm shadow-inner relative">
          <svg className="w-full h-[54px]" viewBox={`0 0 ${svgW} ${svgH}`} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            {/* background subtle gradient */}
            <defs>
              <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopOpacity="0.02" stopColor="#fff" />
                <stop offset="100%" stopOpacity="0.00" stopColor="#000" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={svgW} height={svgH} fill="url(#g1)" rx="8" />

            {/* horizontal grid */}
            {grid.lines.map((val, idx) => {
              const y = valueToY(val);
              const isMajor = Math.abs((val / step) % 2) < 1e-6 || Math.abs(Math.round(val) - val) < 1e-6;
              return (
                <g key={`g-${idx}`}>
                  <line x1={8} y1={y} x2={svgW - 8} y2={y} stroke={isMajor ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'} strokeWidth={isMajor ? 1 : 0.6} />
                  {isMajor && <text x={10} y={y - 4} fontSize={10} fill="rgba(255,255,255,0.75)">{val}</text>}
                </g>
              );
            })}

            {/* rising-only stems (animated) */}
            {pts.map((p, i) => {
              if (!p.isRise) return null; // only show rises
              const baselineY = valueToY(Math.max(0, grid.min));
              const stemTopY = p.y;
              const stemX = p.x;

              return (
                <motion.g key={`r-${i}`} initial={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ duration: 0.36, delay: i * 0.03 }}>
                  {/* stem */}
                  <line x1={stemX} y1={stemTopY} x2={stemX} y2={baselineY} stroke={'rgba(52,211,153,0.98)'} strokeWidth={2} strokeLinecap="round" opacity={0.98} />

                  {/* major ticks along stem for readability */}
                  {grid.lines.map((gv, gi) => {
                    const ty = valueToY(gv);
                    if (ty < stemTopY - 0.5 || ty > baselineY + 0.5) return null;
                    const isMajorTick = Math.abs((gv / step) % 2) < 1e-6;
                    return <line key={`t-${i}-${gi}`} x1={stemX - (isMajorTick ? 6 : 3)} y1={ty} x2={stemX + (isMajorTick ? 6 : 3)} y2={ty} stroke={'rgba(52,211,153,0.98)'} strokeWidth={isMajorTick ? 1 : 0.7} />;
                  })}

                  {/* point */}
                  <circle cx={p.x} cy={p.y} r={4} fill={'#10b981'} stroke={'rgba(255,255,255,0.08)'} strokeWidth={0.6} />

                  {/* small label above point */}
                  <text x={p.x} y={p.y - 8} fontSize={11} textAnchor="middle" fill="#e6fffa" style={{ fontWeight: 600 }}>{p.v.toFixed(2)}</text>
                </motion.g>
              );
            })}

            {/* smooth sparkline lightly on top for context */}
            {pts.length > 1 && (
              <path d={`${pathD}`} stroke={'rgba(14,165,233,0.9)'} strokeWidth={1.6} strokeLinecap={'round'} strokeLinejoin={'round'} fill={'none'} opacity={0.95} />
            )}

            {/* animated lead dot for latest */}
            <motion.circle cx={dotPos.x} cy={dotPos.y} r={4} fill={'#38bdf8'} initial={{ scale: 0.9 }} animate={{ scale: [1.02, 0.96, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
          </svg>

          {/* delta badge */}
          <div className="absolute bottom-3 right-3">
            <AnimatePresence>
              {showDelta && delta > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.38 }}>
                  <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400/95 to-cyan-300/80 px-3 py-1 text-sm font-semibold text-black shadow-md">+{delta.toFixed(2)}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Right: compact ticker */}
      <div className="shrink-0 min-w-[10.5rem] relative h-14">
        <div className="absolute left-2 right-2 top-1/2 transform -translate-y-1/2">
          <div className="w-full overflow-hidden rounded-md px-2 py-1 bg-linear-to-b from-white/3 to-black/3 backdrop-blur-sm border border-white/6 cursor-pointer" onClick={openTrades} role="button" aria-label="Open trades">
            <div className="flex items-center gap-2">
              <div className={`h-1 w-8 rounded-full bg-linear-to-r ${TYPE_ACCENT[activeNotice?.type ?? 'request'] || 'from-cyan-300'}`} />
              <div className="min-w-0">
                <AnimatePresence>
                  {activeNotice ? (
                    <motion.div key={activeNotice.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }}>
                      <div className="text-[12px] text-white/90 truncate">{activeNotice.message}</div>
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>
                      <div className="text-[12px] text-white/60 truncate">No recent trade activity</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only" aria-live="assertive">Live auction. Highest bid {Number(bid).toFixed(2)} by {bidder}.</span>

      <style>{`
        .animate-pulse { animation: pulse 1.6s linear infinite; }
      `}</style>
    </div>
  );
}
