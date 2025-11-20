/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react";

/**
 * CardOverlayAlert
 *
 * Props:
 * - type: "info" | "success" | "warning" | "error"
 * - message: string
 * - open: boolean (controlled) OR when omitted it will open when message is present
 * - duration: ms for auto-dismiss (0 = persistent). default 3000
 * - onClose: () => void
 * - action: { label: string, onClick: () => void } optional
 * - loading: boolean (if true shows loader inside card and disables close)
 * - blocking: boolean (if true overlay blocks click-through; default true)
 * - showClose: boolean (show X close button; default true)
 * - className: extra classes for card
 */
export default function Alert({
  type = "info",
  message,
  open,
  duration = 3000,
  onClose,
  action,
  loading = false,
  blocking = true,
  showClose = true,
  className = "",
}) {
  const [visible, setVisible] = useState(Boolean(open ?? message));
  const [progress, setProgress] = useState(100);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  // sync controlled open
  useEffect(() => {
    if (typeof open === "boolean") setVisible(open);
  }, [open]);

  // open when message is provided (uncontrolled)
  useEffect(() => {
    if (typeof open !== "boolean" && message) setVisible(true);
  }, [message, open]);

  // progress & auto-dismiss
  useEffect(() => {
    if (!visible) {
      setProgress(100);
      cancelAnimationFrame(rafRef.current);
      return;
    }
    if (duration <= 0) return undefined;

    startRef.current = performance.now();
    const end = startRef.current + duration;

    const tick = (ts) => {
      const elapsed = ts - startRef.current;
      const remainingPct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remainingPct);
      if (ts >= end) {
        setVisible(false);
        onClose?.();
        cancelAnimationFrame(rafRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, duration]);

  // close callback when visible toggles off
  useEffect(() => {
    if (!visible) onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // mapper for icons/colors
  const iconNode = (() => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-8 h-8 text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="w-8 h-8 text-amber-400" />;
      case "error":
        return <XCircle className="w-8 h-8 text-rose-400" />;
      default:
        return <Info className="w-8 h-8 text-sky-400" />;
    }
  })();

  // close handler (disabled when loading)
  const handleClose = () => {
    if (loading) return;
    setVisible(false);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          key={`overlay-${message}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          aria-live="polite"
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 ${blocking ? "bg-black/60 backdrop-blur-sm" : "pointer-events-none bg-black/30"}`}
            onClick={() => {
              // allow backdrop click to close only if not loading
              if (!loading && blocking) handleClose();
            }}
            aria-hidden="true"
          />

          {/* Centered card */}
          <motion.div
            key={`card-${message}`}
            initial={{ y: -8, scale: 0.995, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.995, opacity: 0 }}
            transition={{ damping: 30, stiffness: 500, type: "spring" }}
            role="dialog"
            aria-modal="true"
            aria-label={`${type} alert`}
            className={`relative w-[min(92vw,720px)] max-w-3xl pointer-events-auto ${className}`}
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-gradient-to-br from-slate-900/90 to-slate-800/80">
              {/* card content */}
              <div className="p-6 sm:p-7 flex gap-4 items-start">
                <div className="shrink-0 mt-0.5">{iconNode}</div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-100 font-medium break-words">{message}</p>
                      {/* optional subtle helper */}
                      <div className="mt-2 text-xs text-slate-400">This will overlay the page until dismissed.</div>
                    </div>

                    {/* loader area */}
                    <div className="shrink-0 flex items-center gap-2">
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                          <span className="text-xs text-slate-300">Processing...</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* action row */}
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    {action && (
                      <button
                        onClick={() => {
                          if (loading) return;
                          try {
                            action.onClick?.();
                          } catch (e) {}
                        }}
                        className="btn btn-sm btn-primary px-3 py-1.5 rounded-md"
                        aria-label={action.label}
                        disabled={loading}
                      >
                        {action.label}
                      </button>
                    )}

                    {/* close button if allowed */}
                    {showClose && (
                      <button
                        onClick={handleClose}
                        className={`btn btn-ghost btn-sm px-3 py-1.5 rounded-md ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
                        aria-label="Close"
                        disabled={loading}
                      >
                        Close
                      </button>
                    )}

                  </div>
                </div>
              </div>

              {/* progress bar for auto-dismiss (only when duration>0) */}
              {duration > 0 && (
                <div className="h-1 bg-white/5">
                  <div
                    className="h-1 bg-gradient-to-r from-emerald-400 to-sky-400"
                    style={{ width: `${Math.max(0, progress)}%`, transition: "width 0.08s linear" }}
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
