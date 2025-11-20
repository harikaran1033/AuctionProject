/* eslint-disable no-unused-vars */
// Simple working AnimateBudget — no progress bar, no "View" button.
// Just a clean wallet badge + smoothly animated number.
import { useEffect, useState } from "react";
import { useSpring, motion } from "framer-motion";
import { Wallet } from "lucide-react";

const AnimateBudget = ({ budget = 0, label = "Budget" }) => {
  const safe = Math.max(0, Number(budget) || 0);
  const spring = useSpring(safe, { stiffness: 140, damping: 20 });
  const [display, setDisplay] = useState(safe.toFixed(2));

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (!isNaN(v)) setDisplay(Number(v).toFixed(2));
    });
    spring.set(safe);
    return () => unsub();
  }, [safe, spring]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-3 px-3 py-2 rounded-lg  backdrop-blur-sm border border-white/6"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      title={`${label}: ${display} Cr`}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-gradient-to-tr from-yellow-200/20 to-cyan-200/12 border border-white/6">
        <Wallet className="w-4 h-4" />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase text-font text-muted">{label}</span>
        <motion.span
          className={`text-sm font-extrabold tabular-nums ${safe <= 5 ? "text-red-500" : "text-btn1"}`}
          key={display}
          initial={{ scale: 0.98 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 0.45 }}
        >
          {display} <span className="text-xs text-font">Cr</span>
        </motion.span>
      </div>
    </motion.div>
  );
};

export default AnimateBudget;
