import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { liveEventsUrl, type LiveEventMessage } from "../../lib/api";
import { useAuth } from "../auth/useAuth";
import { LiveEventsContext, type ConnectionStatus } from "./liveEventsState";

export function LiveEventsProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const reconnectTimer = useRef<number | null>(null);
  const shouldReconnect = useRef(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [liveEvents, setLiveEvents] = useState<LiveEventMessage[]>([]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setConnectionStatus("idle");
      return;
    }

    shouldReconnect.current = true;
    let socket: WebSocket | null = null;

    function connect(nextStatus: ConnectionStatus = "connecting") {
      setConnectionStatus(nextStatus);
      socket = new WebSocket(liveEventsUrl());

      socket.onopen = () => {
        // Send token as first frame — keeps the bearer credential out of the
        // WebSocket upgrade URL and therefore out of server access logs.
        socket!.send(JSON.stringify({ type: "auth", token: token! }));
        setConnectionStatus("live");
      };

      socket.onmessage = (message) => {
        const payload = JSON.parse(message.data) as LiveEventMessage;
        setLiveEvents((current) => [payload, ...current].slice(0, 12));

        // Live events affect multiple read models: dashboard metrics, event
        // history, asset statuses, incident lists, and selected detail panels.
        // Invalidating by broad keys keeps the data fresh without duplicating
        // mutation logic in every page.
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["assets"] });
        queryClient.invalidateQueries({ queryKey: ["incidents"] });
        queryClient.invalidateQueries({ queryKey: ["asset-detail"] });
        queryClient.invalidateQueries({ queryKey: ["incident-detail"] });
      };

      socket.onclose = (event) => {
        socket = null;
        // 1008 = Policy Violation (auth rejected by server) — stop reconnecting.
        if (!shouldReconnect.current || event.code === 1008) {
          setConnectionStatus("offline");
          return;
        }
        setConnectionStatus("reconnecting");
        reconnectTimer.current = window.setTimeout(() => connect("reconnecting"), 3000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimer.current) {
        window.clearTimeout(reconnectTimer.current);
      }
      socket?.close();
    };
  }, [isAuthenticated, queryClient, token]);

  const value = useMemo(
    () => ({ connectionStatus, liveEvents }),
    [connectionStatus, liveEvents]
  );

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}
