import { useContext } from "react";

import { LiveEventsContext } from "./liveEventsState";

export function useLiveEvents() {
  const context = useContext(LiveEventsContext);
  if (!context) {
    throw new Error("useLiveEvents must be used inside LiveEventsProvider");
  }
  return context;
}
