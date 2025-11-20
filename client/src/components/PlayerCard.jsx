/* eslint-disable no-unused-vars */
/* PlayerCard.jsx */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PlayerIntro from "./PlayerIntro";

/**
 * Props:
 *  - player: { name, nation, role, team, ... }
 *  - soldInfo: { name, winner, price, ts } | null
 *  - soldDisplayMs: number (ms) optional
 */
export default function PlayerCard({
  player,
  soldInfo = null,
  soldDisplayMs = 2200,
  isForeign,
}) {
  const playerKey = `${String(player?.name || "")}|${String(
    player?.nation || ""
  )}|${String(player?.role || "")}`;

  // Check if the parent's soldInfo belongs to this card
  const soldForThisCard = useMemo(() => {
    if (!soldInfo || !soldInfo.name || !player?.name) return null;
    return soldInfo.name.trim().toLowerCase() ===
      player.name.trim().toLowerCase()
      ? soldInfo
      : null;
  }, [soldInfo, player?.name]);

  // local highlight pulse for badge
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!soldForThisCard) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), Math.min(900, soldDisplayMs));
    return () => clearTimeout(t);
  }, [soldForThisCard, soldDisplayMs]);

  // derived sold state values
  const soldState = soldForThisCard
    ? String(soldForThisCard.winner || "").toLowerCase() === "no one"
      ? "unsold"
      : "sold"
    : null;
  const soldPrice = soldForThisCard ? soldForThisCard.price ?? null : null;
  const soldWinner = soldForThisCard ? soldForThisCard.winner ?? null : null;

  // animation variants
  const contentVariants = {
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.32, ease: "easeOut" },
    },
    hidden: {
      opacity: 0.08,
      y: -6,
      scale: 0.995,
      transition: { duration: 0.28, ease: "easeIn" },
    },
  };

  const badgeVariants = {
    initial: { x: -120, opacity: 0, rotate: -8, scale: 0.94 },
    enter: {
      x: 0,
      opacity: 1,
      rotate: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 580, damping: 36, mass: 0.9 },
    },
    pop: {
      scale: [1, 1.08, 0.98, 1],
      transition: {
        duration: Math.min(0.9, soldDisplayMs / 1000),
        times: [0, 0.4, 0.7, 1],
      },
    },
    exit: { opacity: 0, y: 26, scale: 0.92, transition: { duration: 0.22 } },
  };

  // connector path animation values
  const connectorPath = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 0.85,
      transition: { duration: 0.28, ease: "easeOut" },
    },
    exit: { pathLength: 0, opacity: 0, transition: { duration: 0.18 } },
  };

  return (
    <div className="w-full bg-transparent rounded-xl p-3 flex flex-col items-center relative overflow-hidden">
      {/* subtle overlay & blur when sold badge is present */}
      <AnimatePresence>
        {soldState && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{
              opacity: 1,
              backdropFilter: "blur(4px)",
              transition: { duration: 0.22 },
            }}
            exit={{
              opacity: 0,
              backdropFilter: "blur(0px)",
              transition: { duration: 0.18 },
            }}
            className="absolute inset-0 z-15 pointer-events-none"
            style={{ background: "rgba(6,6,6,0.06)" }}
          />
        )}
      </AnimatePresence>

      {/* PlayerIntro stays but will be visually dimmed when soldForThisCard is present */}
      <motion.div
        // animate content subtly when sold happens
        variants={contentVariants}
        animate={soldForThisCard ? "hidden" : "visible"}
        initial="visible"
        className="w-full z-10"
      >
        {/* pass playerKey so PlayerIntro can use layoutId for the name */}
        <PlayerIntro
          playerKey={playerKey}
          name={player?.name}
          nation={player?.nation}
          role={player?.role}
          team={player?.team}
          isForeign={isForeign}
        />

      {/* ----- Player style / role area (replaces previous single-line role) ----- */}
<div className="text-sm font-text flex flex-col gap-1 mt-1 w-full">
  {/* compute style parts */}
  {(() => {
    const rawStyle =
      player?.playerStyle ?? player?.PLAYER_STYLE ?? player?.role ?? "";
    const styleParts = String(rawStyle)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // primary text: prefer first style part, else role or dash
    const primary = styleParts.length > 0 ? styleParts[0] : (player?.role ?? "-");
    // remaining parts as chips
    const extras = styleParts.slice(1);

    return (
      <>
        <div className="flex items-center justify-between">
          <p className="font-body font-semibold text-xs text-font leading-tight truncate ">
            {primary}
          </p>
          <p className="flex font-body flex-col items-center  text-xs font-semibold">
            {player?.nation}
          </p>
        </div>

        {/* show extra style parts as chips if present */}
        {/* {extras.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {extras.map((part, i) => (
              <span
                key={i}
                className="inline-block text-[11px] px-2 py-0.5 bg-card2 rounded-full border border-border/40 text-muted font-medium"
                aria-hidden="true"
                title={part}
              >
                {part}
              </span>
            ))}
          </div>
        )} */}
      </>
    );
  })()}
</div>

      </motion.div>


{/* Sold/Unsold badge - local animation (no layoutId) */}
<div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
  <AnimatePresence>
    {soldState && (
      <motion.div
        key={`${player?.name}-sold-wrap`}
        initial={{ opacity: 0, y: -6, scale: 0.96 }}
        animate={
          pulse
            ? { opacity: 1, y: 0, scale: [1, 1.06, 0.98, 1], transition: { duration: Math.min(0.9, soldDisplayMs/1000) } }
            : { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22 } }
        }
        exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.18 } }}
        className="pointer-events-auto flex items-center justify-center z-30"
        style={{ padding: 10 }}
      >
        {/* small, card-scoped connector svg (optional) */}
        <svg
          width="120"
          height="40"
          viewBox="0 0 120 40"
          className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ overflow: "visible" }}
          aria-hidden
        >
          <path
            d="M10,30 C30,28 90,28 110,30"
            stroke="rgba(0,0,0,0.09)"
            strokeWidth="0.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        <div
          // NO layoutId here
          className="pointer-events-auto flex flex-col items-center text-center rounded-lg"
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            background: soldState === "unsold"
              ? "linear-gradient(180deg,#ef4444,#dc2626)"
              : "linear-gradient(180deg,#0b63d4,#063b8a)",
            color: "white",
            boxShadow: "0 10px 30px rgba(2,6,23,0.18)",
            minWidth: 160,
          }}
        >
          {soldState === "unsold" ? (
            <>
              <p className="text-lg font-heading font-extrabold leading-tight truncate">
                {player?.name}
              </p>
              <p className="text-xs mt-1 font-medium uppercase tracking-wide">
                Unsold
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide">
                Sold to
              </p>
              {soldWinner && (
                <p className="text-lg font-heading font-extrabold mt-1 leading-tight truncate">
                  {soldWinner}
                </p>
              )}
              {soldPrice != null && (
                <p className="text-sm mt-1 font-medium">
                  ₹{Number(soldPrice).toFixed(2)} Cr
                </p>
              )}
            </>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>

    </div>
  );
}
