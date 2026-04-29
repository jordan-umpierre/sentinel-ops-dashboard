import { MapPin, RadioTower, ScanLine, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "../../components/StatusBadge";
import { apiClient, type Asset } from "../../lib/api";
import { formatRelativeTime } from "../../lib/date";
import { assetStatusTone } from "../../lib/tones";
import { useAuth } from "../auth/useAuth";

const zones = [
  { name: "North Gate", className: "left-[56%] top-[8%] h-[22%] w-[32%]" },
  { name: "Cold Storage", className: "left-[10%] top-[12%] h-[28%] w-[34%]" },
  { name: "Loading Yard", className: "left-[42%] top-[42%] h-[42%] w-[46%]" },
  { name: "Perimeter West", className: "left-[4%] top-[48%] h-[38%] w-[26%]" },
  { name: "Roofline East", className: "left-[78%] top-[22%] h-[18%] w-[16%]" }
];

function normalizeAssetPosition(asset: Asset, assets: Asset[]) {
  // The backend stores real-ish coordinates. This normalization projects them
  // into an abstract facility plan so the site view can stay data-driven.
  const latitudes = assets.map((item) => item.latitude);
  const longitudes = assets.map((item) => item.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;
  const x = 10 + ((asset.longitude - minLon) / lonRange) * 78;
  const y = 12 + (1 - (asset.latitude - minLat) / latRange) * 72;
  return { x, y };
}

export function SitePage() {
  const { token } = useAuth();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const assetsQuery = useQuery({
    queryKey: ["assets", "site-view"],
    queryFn: () => apiClient.getAssets(token!, { sort: "status" }),
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (!selectedAssetId && assetsQuery.data?.length) {
      const firstAlertAsset = assetsQuery.data.find((asset) => asset.status !== "nominal");
      setSelectedAssetId(firstAlertAsset?.id ?? assetsQuery.data[0].id);
    }
  }, [assetsQuery.data, selectedAssetId]);

  const selectedAsset = assetsQuery.data?.find((asset) => asset.id === selectedAssetId) ?? null;
  const statusCounts = useMemo(() => {
    const counts = { nominal: 0, watch: 0, alert: 0, offline: 0 };
    assetsQuery.data?.forEach((asset) => {
      counts[asset.status] += 1;
    });
    return counts;
  }, [assetsQuery.data]);

  return (
    <div className="space-y-5">
      <section className="border border-white/10 bg-ink-850 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Common Operating Picture</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Site View</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              A simplified 2D facility plan for scanning asset positions, site zones, and operational
              attention points without adding map infrastructure too early.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <MiniCount label="nominal" value={statusCounts.nominal} tone="green" />
            <MiniCount label="watch" value={statusCounts.watch} tone="amber" />
            <MiniCount label="alert" value={statusCounts.alert} tone="red" />
            <MiniCount label="offline" value={statusCounts.offline} tone="neutral" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[560px] overflow-hidden border border-white/10 bg-ink-850 shadow-panel">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-signal-cyan" />
              <h3 className="font-semibold text-white">Northstar Facility Plan</h3>
            </div>
            <StatusBadge value="2D operational layout" tone="cyan" />
          </div>

          <div className="relative h-[506px] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:48px_48px]">
            {zones.map((zone) => (
              <div
                key={zone.name}
                className={`absolute border border-white/10 bg-white/[0.03] ${zone.className}`}
              >
                <span className="absolute left-3 top-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {zone.name}
                </span>
              </div>
            ))}

            {assetsQuery.isLoading ? (
              <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
                Loading site assets...
              </div>
            ) : assetsQuery.isError || !assetsQuery.data ? (
              <div className="absolute inset-0 grid place-items-center text-sm text-signal-red">
                Site assets are unavailable.
              </div>
            ) : (
              assetsQuery.data.map((asset) => {
                const position = normalizeAssetPosition(asset, assetsQuery.data);
                const isSelected = asset.id === selectedAssetId;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={`absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center border transition ${
                      isSelected
                        ? "border-signal-cyan bg-signal-cyan text-ink-950"
                        : "border-white/20 bg-ink-950 text-slate-200 hover:border-signal-cyan"
                    }`}
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    aria-label={`Inspect ${asset.name}`}
                    title={asset.name}
                  >
                    <MapPin className="h-5 w-5" />
                  </button>
                );
              })
            )}
          </div>
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
                  <StatusBadge value={selectedAsset.status} tone={assetStatusTone[selectedAsset.status]} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {selectedAsset.asset_type} positioned in {selectedAsset.zone}. Last telemetry update was{" "}
                  {formatRelativeTime(selectedAsset.last_seen_at)}.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SiteStat label="Battery" value={`${selectedAsset.battery_level}%`} />
                <SiteStat label="Latitude" value={selectedAsset.latitude.toFixed(4)} />
                <SiteStat label="Longitude" value={selectedAsset.longitude.toFixed(4)} />
                <SiteStat label="Zone" value={selectedAsset.zone} />
              </div>

              {selectedAsset.status !== "nominal" ? (
                <div className="border border-signal-amber/30 bg-signal-amber/10 p-4">
                  <div className="flex items-center gap-2 text-signal-amber">
                    <ShieldAlert className="h-4 w-4" />
                    <p className="text-sm font-semibold">Operator attention recommended</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Review the asset detail and event history pages for linked telemetry before closing
                    the loop.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="p-5 text-sm text-slate-400">Select a marker to inspect asset state.</div>
          )}
        </aside>
      </section>
    </div>
  );
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
