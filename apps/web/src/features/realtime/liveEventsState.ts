import { createContext } from "react";

import type { LiveEventMessage } from "../../lib/api";

export type ConnectionStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export type LiveEventsContextValue = {
  connectionStatus: ConnectionStatus;
  liveEvents: LiveEventMessage[];
};

// The context definition is separated from the provider so React Fast Refresh
// can reload component files without warning about mixed exports.
export const LiveEventsContext = createContext<LiveEventsContextValue | undefined>(undefined);
