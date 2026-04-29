import L from "leaflet";
import { AlertTriangle, RadioTower, ScanLine, ShieldAlert } from "lucide-react";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "../../components/StatusBadge";
import { apiClient, type Asset, type AssetStatus } from "../../lib/api";
import { formatRelativeTime } from "../../lib/date";
import { assetStatusTone } from "../../lib/tones";
import { useLiveEvents } from "../realtime/useLiveEvents";
import { useAuth } from "../auth/useAuth";

// CartoDB Dark Matter tiles — free, no API key, matches our ink-950 palette.
const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Hex colors for each asset status, used to paint both the marker border and
// the live-event pulse ring so the two visual systems stay in sync.
const STATUS_COLOR: Record<AssetStatus, string> = {
  nominal: "#22c55e",
  watch:   "#f7b955",
  alert:   "#ef4444",
  offline: "#64748b"
};
const SELECTED_COLOR = "#38d8d8"; // signal-cyan

// How long a live-event pulse ring stays visible on the map (ms).
const PULSE_DURATION_MS = 6000;

// Build a square divIcon whose border and fill color reflect the asset's status.
// Using divIcon avoids the default Leaflet PNG markers that break in Vite due to
// asset URL resolution, and lets the markers match our square-edged design system.
function makeAssetIcon(status: AssetStatus, isSelected: boolean): L.DivIcon {
  const color = isSelected ? SELECTED_COLOR : STATUS_COLOR[status];
  const size = isSelected ? 44 : 36;
  const bgAlpha = isSelected ? "30" : "18";
  return L.divIcon({
    className: "",
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;
      border:2px solid ${color};
      background:${color}${bgAlpha};
      display:flex;align-items:center;justify-content:center;
      transition:all 0.15s;
    "><div style="width:8px;height:8px;background:${color};border-radius:50%;"></div></div>`
  });
}

// Fits the map viewport to all asset positions on first render.
// Wrapped as a child of MapContainer so it can call useMap() per react-leaflet rules.
function FitToBounds({ assets }: { assets: Asset[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !assets.length) return;
    const bounds = L.latLngBounds(assets.map((a) => [a.latitude, a.longitude]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    fitted.current = true;
  }, [assets, map]);
  return null;
}

type PulseRing = { id: string; lat: number; lon: number; color: string };

export function SitePage() {
  const { token } = useAuth();
  const { liveEvents } = useLiveEvents();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [pulseRings, setPulseRings] = useState<PulseRing[]>([]);

  const assetsQuery = useQuery({
    queryKey: ["assets", "site-view"],
    queryFn: () => apiClient.getAssets(token!, { sort: "status" }),
    enabled: Boolean(token),
    // Refetch every 30 s so status changes appear on the map without a manual reload.
    refetchInterval: 30_000
  });

  // Auto-select the highest-priority asset on first load (alert > watch > nominal).
  useEffect(() => {
    if (!selectedAssetId && assetsQuery.data?.length) {
      const priority = assetsQuery.data.find((a) => a.status !== "nominal");
      setSelectedAssetId(priority?.id ?? assetsQuery.data[0].id);
    }
  }, [assetsQuery.data, selectedAssetId]);

  const selectedAsset =
    assetsQuery.data?.find((a) => a.id === selectedAssetId) ?? null;

  // Derive status summary counts for the header stat row.
  const statusCounts = useMemo(() => {
    const counts = { nominal: 0, watch: 0, alert: 0, offline: 0 };
    assetsQuery.data?.forEach((a) => { counts[a.status] += 1; });
    return counts;
  }, [assetsQuery.data]);

  // When a new live event arrives, add a short-lived pulse ring at the asset's
  // last-known position. This gives the operator instant spatial context for
  // where activity is happening — a key pattern in ECHO-style visualizations.
  const latestEvent = liveEvents[0] ?? null;
  useEffect(() => {
    if (!latestEvent?.asset) return;
    const { latitude, longitude, status } = latestEvent.asset;
    const ring: PulseRing = {
      id: `${latestEvent.event.id}-${Date.now()}`,
      lat: latitude,
      lon: longitude,
      color: STATUS_COLOR[status as AssetStatus] ?? SELECTED_COLOR
    };
    setPulseRings((prev) => [ring, ...prev.slice(0, 4)]); // keep at most 5 rings
    const timer = setTimeout(
      () => setPulseRings((prev) => prev.filter((r) => r.id !== ring.id)),
      PULSE_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, [latestEvent]);

  return (
    <div className="space-y-5">
      <section className="border border-white/10 bg-ink-850 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Common Operating Picture
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Live Asset Map</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Real-time field positions for all monitored assets. Cyan pulse rings mark where
              the most recent telemetry events fired. Click any marker to inspect asset state
              in the detail panel.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <MiniCount label="nominal" value={statusCounts.nominal} tone="green" />
            <MiniCount label="watch"   value={statusCounts.watch}   tone="amber" />
            <MiniCount label="alert"   value={statusCounts.alert}   tone="red"   />
            <MiniCount label="offline" value={statusCounts.offline} tone="neutral" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden border border-white/10 shadow-panel">
          <div className="flex h-14 items-center justify-between border-b border-white/10 bg-ink-850 px-5">
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-signal-cyan" />
              <h3 className="font-semibold text-white">Northstar Facility — Live View</h3>
            </div>
            <StatusBadge value="live telemetry" tone="cyan" />
          </div>

          {/* MapErrorBoundary catches Leaflet tile failures, WebGL unavailability,
              and any other map-layer exception so a single bad render can't take
              down the entire ops console. The fallback keeps the sidebar usable. */}
          <MapErrorBoundary>
          <MapContainer
            center={[41.881, -87.63]}
            zoom={15}
            style={{ height: "560px", width: "100%" }}
            zoomControl
            attributionControl
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTR} />

            {assetsQuery.data && (
              <>
                <FitToBounds assets={assetsQuery.data} />

                {assetsQuery.data.map((asset) => (
                  <Marker
                    key={asset.id}
                    position={[asset.latitude, asset.longitude]}
                    icon={makeAssetIcon(asset.status, asset.id === selectedAssetId)}
                    eventHandlers={{ click: () => setSelectedAssetId(asset.id) }}
                    zIndexOffset={asset.id === selectedAssetId ? 1000 : 0}
                  >
                    {/* Tooltip appears on hover — call sign + status so operators
                        can scan the map without clicking every marker. */}
                    <Tooltip direction="top" offset={[0, -20]}>
                      <span className="font-semibold">{asset.call_sign}</span>
                      <br />
                      {asset.name} · {asset.status}
                    </Tooltip>
                  </Marker>
                ))}
              </>
            )}

            {/* Pulse rings mark recent live-event positions. Radius is in metres;
                ~60 m gives a visible ring at the street-level zoom without drowning
                adjacent markers. The ring fades out when PULSE_DURATION_MS elapses. */}
            {pulseRings.map((ring) => (
              <Circle
                key={ring.id}
                center={[ring.lat, ring.lon]}
                radius={55}
                pathOptions={{
                  color:       ring.color,
                  fillColor:   ring.color,
                  fillOpacity: 0.12,
                  weight:      2
                }}
              />
            ))}
          </MapContainer>
          </MapErrorBoundary>
        </div>

        <aside className="border border-white/10 bg-ink-850 shadow-panel">
          <div className="flex h-14 items-center gap-2 border-b border-white/10 px-5">
            <RadioTower className="h-4 w-4 text-signal-cyan" />
            <h3 className="font-semibold text-white">Selected Asset</h3>
          </div>

          {selectedAsset ? (
            <div className="space-y-5 p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      {selectedAsset.call_sign}
                    </p>
                    <h4 className="mt-2 text-xl font-semibold text-white">{selectedAsset.name}</h4>
                  </div>
                  <StatusBadge
                    value={selectedAsset.status}
                    tone={assetStatusTone[selectedAsset.status]}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {selectedAsset.asset_type} positioned in {selectedAsset.zone}. Last telemetry
                  update was {formatRelativeTime(selectedAsset.last_seen_at)}.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SiteStat label="Battery"   value={`${selectedAsset.battery_level}%`} />
                <SiteStat label="Latitude"  value={selectedAsset.latitude.toFixed(4)} />
                <SiteStat label="Longitude" value={selectedAsset.longitude.toFixed(4)} />
                <SiteStat label="Zone"      value={selectedAsset.zone} />
              </div>

              {selectedAsset.status !== "nominal" && (
                <div className="border border-signal-amber/30 bg-signal-amber/10 p-4">
                  <div className="flex items-center gap-2 text-signal-amber">
                    <ShieldAlert className="h-4 w-4" />
                    <p className="text-sm font-semibold">Operator attention recommended</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Review the asset detail and event history pages for linked telemetry before
                    closing the loop.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-sm text-slate-400">
              Select a marker to inspect asset state.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

// React error boundaries must be class components — hooks can't catch render errors.
// This boundary is scoped to the map so a Leaflet failure (bad tile URL, WebGL
// context lost, react-leaflet version mismatch) can't crash the whole ops console.
class MapErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="grid place-items-center border border-signal-red/30 bg-signal-red/5 text-center"
          style={{ height: "560px" }}
        >
          <div className="space-y-3">
            <AlertTriangle className="mx-auto h-8 w-8 text-signal-red/60" />
            <p className="text-sm font-medium text-signal-red">Map renderer failed to load</p>
            <p className="text-xs text-slate-500">
              Asset state is still available in the Assets page.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="mt-2 border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:text-white"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MiniCount({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "neutral" | "green" | "amber" | "red";
}) {
  return (
    <div className="border border-white/10 bg-ink-950 px-3 py-2">
      <p className="text-lg font-semibold text-white">{value}</p>
      <StatusBadge value={label} tone={tone} />
    </div>
  );
}

function SiteStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-ink-950 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
