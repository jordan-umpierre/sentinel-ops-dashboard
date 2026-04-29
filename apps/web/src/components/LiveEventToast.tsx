import { AlertTriangle, Info, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { LiveEventMessage } from "../lib/api";
import { severityTone } from "../lib/tones";
import { StatusBadge } from "./StatusBadge";

// How long a toast stays visible before auto-dismissing (ms).
const TOAST_DURATION_MS = 5000;

type ToastItem = LiveEventMessage & { toastId: string };

type Props = {
  latestEvent: LiveEventMessage | null;
};

/**
 * LiveEventToast renders a non-blocking notification at the bottom-right
 * whenever the WebSocket stream delivers a new event. It auto-dismisses
 * and allows manual close.
 *
 * Keeping this component separate from the LiveEventsContext means the
 * notification layer can be removed or swapped without touching data flow.
 */
export function LiveEventToast({ latestEvent }: Props) {
  // Track the most recently displayed toast independently of the live events
  // list — we only want to show a toast for genuinely new arrivals, not
  // re-renders of already-seen events.
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!latestEvent) return;

    // Skip events we've already shown a toast for (e.g., on reconnect the same
    // event might appear in liveEvents again).
    if (latestEvent.event.id === lastEventIdRef.current) return;

    lastEventIdRef.current = latestEvent.event.id;
    const toastId = `${latestEvent.event.id}-${Date.now()}`;
    setToast({ ...latestEvent, toastId });

    // Clear any existing timer before starting a new one so rapid events don't
    // stack timers that dismiss the newest toast early.
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [latestEvent]);

  if (!toast) return null;

  const isCritical =
    toast.event.severity === "critical" || toast.event.severity === "high";

  return (
    // Fixed bottom-right overlay that doesn't interrupt the operator's work area
    <div className="fixed bottom-6 right-6 z-50 w-[340px] animate-slide-in">
      <div
        className={`border bg-ink-900 shadow-lg ${
          isCritical ? "border-signal-red/50" : "border-white/15"
        }`}
      >
        {/* Header row with severity badge, live indicator, and dismiss button */}
        <div className="flex h-10 items-center justify-between border-b border-white/10 px-3">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-signal-cyan" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-cyan">
              Live Event
            </span>
            <StatusBadge value={toast.event.severity} tone={severityTone[toast.event.severity]} />
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="grid h-6 w-6 place-items-center text-slate-500 transition hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Event body */}
        <div className="px-3 py-3">
          <p className="text-sm font-medium leading-5 text-white">{toast.event.message}</p>
          <p className="mt-1.5 text-xs uppercase tracking-[0.16em] text-slate-500">
            {toast.event.source} · {toast.event.zone}
          </p>

          {/* If this event triggered or updated an incident, call it out */}
          {toast.incident && (
            <div className="mt-3 flex items-start gap-2 border border-signal-amber/30 bg-signal-amber/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-amber" />
              <p className="text-xs leading-5 text-signal-amber">
                Incident: <span className="font-semibold">{toast.incident.title}</span>
              </p>
            </div>
          )}

          {/* Non-critical events get a softer info treatment */}
          {!isCritical && !toast.incident && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Info className="h-3 w-3" />
              Routine telemetry — no operator action required
            </div>
          )}
        </div>

        {/* Auto-dismiss progress bar — purely visual feedback */}
        <div className="h-[2px] w-full bg-white/5">
          <div
            className="h-full bg-signal-cyan/60"
            style={{ animation: `shrink ${TOAST_DURATION_MS}ms linear forwards` }}
          />
        </div>
      </div>
    </div>
  );
}
