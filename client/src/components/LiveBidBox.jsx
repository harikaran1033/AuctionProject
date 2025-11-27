/* eslint-disable no-useless-escape */
/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue, animate } from "framer-motion";

/**
 * LiveBidBox — Compact Futuristic v3 (adjusted)
 * - Removed volume (no "Vol" badge)
 * - Stats row made stretchy so elements keep nicer spacing and the sparkline stays visible on small screens
 * - All functions wired so the component works out-of-the-box
 */

function AnimatedNumber({ value = 0, decimals = 2, className = "" }) {
  const spring = useSpring(Number(value) || 0, { stiffness: 260, damping: 36 });
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
  return <span className={className}>{nf.format(display)}</span>;
}

const TYPE_STYLE = {
  request: { bg: "linear-gradient(90deg,#F59E0B66,#F9731666)", text: "#111" },
  declined: { bg: "linear-gradient(90deg,#FB718566,#F43F5E66)", text: "#111" },
  accepted: { bg: "linear-gradient(90deg,#34D39966,#06B6D466)", text: "#041014" },
  executed: { bg: "linear-gradient(90deg,#60A5FA66,#06B6D466)", text: "#041014" },
  updated: { bg: "linear-gradient(90deg,#9CA3AF66,#6B728066)", text: "#041014" },
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
  step = 0.5,
}) {
  const storageKey = roomId ? `livebid_history::${roomId}` : `livebid_history::global`;

  // friendly bidder name resolver
  const bidderName = useMemo(() => {
    if (!bidder) return "—"; // clear visible placeholder
    if (typeof bidder === "string") return bidder;
    return bidder?.name || bidder?.username || "—";
  }, [bidder]);

  // history
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

  useEffect(() => {
    // keep localStorage synced even if roomId changes
    try {
      if (history && history.length) localStorage.setItem(storageKey, JSON.stringify(history.slice(-maxPoints)));
    } catch (e) {}
  }, [history, maxPoints, storageKey]);

  const prevBidRef = useRef(bid);
  const [delta, setDelta] = useState(0);
  const [showDelta, setShowDelta] = useState(false);
  const [lastUpdatedTs, setLastUpdatedTs] = useState(Date.now());

  // motion value for percent change and visible pct state
  const pctMv = useMotionValue(0);
  const [pctLabel, setPctLabel] = useState("0.00%");

  useEffect(() => {
    const unsubscribe = pctMv.on("change", (v) => {
      setPctLabel(`${Number(v || 0).toFixed(2)}%`);
    });
    return () => unsubscribe && unsubscribe();
  }, [pctMv]);

  useEffect(() => {
    const prev = prevBidRef.current ?? 0;
    if (typeof bid !== "number") return;
    if (bid !== prev) {
      const inc = +(bid - prev).toFixed(2);
      setDelta(inc > 0 ? inc : 0);
      setShowDelta(inc > 0);
      setLastUpdatedTs(Date.now());

      // update history
      setHistory((h) => {
        const next = [...h.slice(-maxPoints + 1), bid];
        return next;
      });

      // animate percent change
      const pct = prev === 0 ? 0 : ((bid - prev) / Math.abs(prev)) * 100;
      const anim = animate(pctMv, pct, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] });

      const t = setTimeout(() => setShowDelta(false), 1600);
      prevBidRef.current = bid;
      return () => {
        anim.stop();
        clearTimeout(t);
      };
    }
    prevBidRef.current = bid;
  }, [bid, maxPoints, pctMv]);

  // compact sparkline dims
  const svgW = 140;
  const svgH = 36;

  const pts = useMemo(() => {
    if (!history.length) return [];
    const arr = history.slice(-maxPoints);
    const maxV = Math.max(...arr, bid);
    const minV = Math.min(...arr, bid);
    const pad = Math.max(step * 2, (maxV - minV) * 0.06 || step * 2);
    const max = maxV + pad;
    const min = Math.max(0, minV - pad);
    const valueRange = max === min ? 1 : max - min;
    const slotCount = arr.length;
    const slotWidth = slotCount > 1 ? svgW / slotCount : svgW;
    return arr.map((v, i) => {
      const x = slotWidth * i + slotWidth / 2;
      const y = ((max - v) / valueRange) * (svgH - 12) + 6;
      const prev = i > 0 ? arr[i - 1] : null;
      const isRise = prev !== null ? v > prev : false;
      return { x, y, v, isRise };
    });
  }, [history, maxPoints, svgW, svgH, step, bid]);

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
  const lastPoint = pts.length ? pts[pts.length - 1] : { x: svgW - 6, y: svgH / 2, v: bid };

  // notice queue and animation variants for smooth warning
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
    const dur = 2200;
    if (activeTimerRef.current) {
      clearTimeout(activeTimerRef.current);
      activeTimerRef.current = null;
    }
    activeTimerRef.current = setTimeout(() => {
      setActiveNotice(null);
      activeTimerRef.current = null;
      setTimeout(() => {
        if (queueRef.current.length) dequeueAndShow();
      }, 120);
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
      (type === "accepted" && `${fromName} accepted`) ||
      (type === "declined" && `${fromName} declined`) ||
      (type === "executed" && `${fromName} executed`) ||
      (type === "request" && (playerRequestedName ? `${fromName} → ${playerRequestedName}` : `${fromName} requested`)) ||
      `${fromName} updated`;

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
    <div
      className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl w-full max-w-[720px] bg-white/5  backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      {/* Left: Live + fused notice */}
      <div className="flex items-center gap-3 min-w-0" style={{ flex: "0 0 auto" }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold tracking-wide text-red-500 uppercase">Live</div>

            <div className="min-w-0">
              <AnimatePresence>
                {activeNotice ? (
                  <motion.button
                    key={activeNotice.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.36 }}
                    onClick={openTrades}
                    className="ml-1 inline-flex items-center gap-2 text-[12px] px-3 py-1 rounded-full font-semibold"
                    aria-label={`Trade notice: ${activeNotice.message}`}
                    style={{
                      background: TYPE_STYLE[activeNotice.type]?.bg || TYPE_STYLE.request.bg,
                      color: TYPE_STYLE[activeNotice.type]?.text || "#001",
                      boxShadow: "0 6px 22px rgba(34,211,238,0.08)",
                      transformOrigin: "left center",
                      maxWidth: '14rem',
                    }}
                  >
                    <motion.span
                      className="w-3 h-3 rounded-full"
                      layout
                      initial={{ scale: 0.8, opacity: 0.9 }}
                      animate={{ scale: [1, 0.9, 1.05], opacity: [0.9, 0.6, 0.9] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ background: "rgba(255,255,255,0.18)" }}
                    />
                    <span className="truncate">{activeNotice.message}</span>
                  </motion.button>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28 }}>
                    <div className="text-[12px] text-white/40">No recent trades</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* primary stats row (responsive - now stretchy) */}
          <div className="flex items-center gap-3 mt-1 w-full min-w-0">
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="text-sm font-extrabold text-white/95 leading-none"><AnimatedNumber value={bid} decimals={2} /> cr</div>
              <div className="text-[12px] text-zinc-400 truncate">{bidderName}</div>
            </div>

            {/* right-side compact badges */}
            <div className="flex items-center gap-2" style={{ flex: '0 0 auto' }}>
              <div className="text-[12px] font-medium px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.02)', color: '#9ae6ff' }}>
                {pctLabel}
              </div>

             

          
            </div>
          </div>
        </div>
      </div>

      {/* Center/Right: sparkline only (no round bar) and responsive visibility */}
      <div className="relative flex-1 flex items-center justify-end min-w-0" style={{ flexBasis: 0 }}>
        <div className="w-[190px] sm:w-[220px] h-10 rounded-md px-2 py-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] border border-white/5 flex items-center gap-3" onClick={openTrades} role="button" aria-label="Open trades">
          <div className="flex-1 h-full flex items-center">
            <svg className="w-full h-full" viewBox={`0 0 ${svgW} ${svgH}`} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <defs>
                <linearGradient id="gFut2" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#000" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width={svgW} height={svgH} fill="url(#gFut2)" rx="6" />

              {/* neon rising bars only (thin) */}
              {pts.map((p, i) => {
                if (!p.isRise) return null;
                const baselineY = svgH - 6;
                const stemTopY = p.y;
                const stemX = p.x;
                const barH = Math.max(2, baselineY - stemTopY);
                return (
                  <g key={`c-${i}`}>
                    <rect x={stemX - 1.2} y={stemTopY} width={2.4} height={barH} rx={1.2} fill="#06b6d4" opacity={0.95} />
                  </g>
                );
              })}

              {/* sparkline path for context */}
              {pts.length > 1 && (
                <path d={`${pathD}`} stroke={'rgba(96,165,250,0.95)'} strokeWidth={1.2} fill={'none'} opacity={0.95} strokeLinecap={'round'} strokeLinejoin={'round'} />
              )}

              {/* lead dot with subtle breathing */}
              <motion.circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={'#60a5fa'} stroke={'rgba(255,255,255,0.06)'} strokeWidth={0.6} initial={{ scale: 0.9 }} animate={{ scale: [1, 0.92, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
            </svg>
          </div>
        </div>

            {/* delta badge */}
              <AnimatePresence>
                {showDelta && delta > 0 && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.36 }}>
                    <div className="ml-1 text-[12px] font-semibold px-2 py-0.5 rounded-md text-black absolute bottom-0 right-0" style={{ background: 'linear-gradient(90deg,#34D399,#06B6D4)' }}>+{delta.toFixed(2)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
      </div>

      <span className="sr-only" aria-live="assertive">Live auction. Highest bid {Number(bid).toFixed(2)} by {bidderName}.</span>

      <style>{`
        .pulse { animation: pulse 1.6s linear infinite; }
        @media (max-width: 520px) {
          /* mobile: stack stats and keep sparkline visible */
          .flex\:items-center { align-items: center; }
        }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1 } 70% { transform: scale(1.4); opacity: 0.18 } 100% { transform: scale(1.8); opacity: 0 } }
      `}</style>
    </div>
  );
}
