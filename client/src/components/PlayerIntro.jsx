/* eslint-disable no-unused-vars */
/* PlayerIntro.jsx */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plane } from "lucide-react"; // <-- add this import

export default function PlayerIntro({
  playerKey = "",
  name = "",
  nation = "",
  role = "",
  team = "",
  isForeign = false, 
}) {
  const [showIntro, setShowIntro] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    setShowIntro(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowIntro(false), 2200);
    return () => clearTimeout(timerRef.current);
  }, [playerKey]);

  const nameVariants = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.48, ease: "easeOut" } },
  };

  const roleVariants = {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { delay: 0.16, duration: 0.36 } },
  };

  const isFlag = nation && nation.length <= 3;
  const countryText = isFlag ? "" : nation;
  const flagEmoji = isFlag ? nation : "";

  return (
    <div className="w-full flex items-center justify-center">
      {showIntro ? (
        <motion.div
          key={`${playerKey}-intro`}
          initial="hidden"
          animate="show"
          variants={nameVariants}
          className="flex flex-col items-center justify-center px-6 py-3 rounded-2xl"
        >
          <motion.div
            variants={nameVariants}
            className="flex items-center gap-2 text-2xl font-semibold text-red-500"
          >
            {flagEmoji && <span style={{ fontSize: 22 }}>{flagEmoji}</span>}
            {countryText && <span>{countryText}</span>}

            {/* Flight icon small in intro view if foreign */}
            {isForeign && (
              <span title="Foreign player" className="ml-1 text-xs text-slate-300">
                <Plane className="w-4 h-4 inline-block text-amber-300" />
              </span>
            )}
          </motion.div>

          <motion.div variants={roleVariants} className="text-xs uppercase mt-1 text-batting">
            {role || "Player"}
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key={`${playerKey}-main`}
          initial="hidden"
          animate="show"
          variants={nameVariants}
          className="flex flex-col items-center justify-center px-6 py-3 rounded-2xl"
        >
          <motion.p
            layoutId={`player-name-${playerKey}`}
            variants={nameVariants}
            className="text-2xl text-center font-heading text-playerName font-extrabold text-player"
          >
            {name || "Unknown Player"}

            {/* Flight icon beside name when not in intro */}
            {isForeign && (
              <span title="Foreign player" className="ml-2 inline-flex items-center">
                <Plane className="w-5 h-5 text-amber-400" />
              </span>
            )}
          </motion.p>

          <motion.p variants={roleVariants} className="text-sm mt-1 font-medium text-text">
            {team || "Unknown Team"}
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}
