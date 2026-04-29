import { BatteryCharging, Filter, Radar, Search, Signal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AssetDetailSkeleton, TableRowSkeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { apiClient, type Asset, type AssetFilters } from "../../lib/api";
import { formatRelativeTime } from "../../lib/date";
import { useDebounce } from "../../lib/useDebounce";
import { assetStatusTone, incidentStatusTone, severityTone } from "../../lib/tones";
import { useAuth } from "../auth/useAuth";

const assetStatuses = ["", "nominal", "watch", "alert", "offline"] as const;
const assetTypes = ["", "personnel", "vehicle", "sensor", "gateway"] as const;

function metadataEntries(metadata: Record<string, unknown>) {
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value)
  }));
}

export function AssetsPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssetFilters["status"]>("");
  const [assetType, setAssetType] = useState<AssetFilters["asset_type"]>("");
  const [sort, setSort] = useState<AssetFilters["sort"]>("name");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Debounce the search string so the API is queried only after the user pauses
  // typing, not on every keystroke. The other filter fields change via select
  // (discrete events) and don't need debouncing.
  const debouncedSearch = useDebounce(search, 300);

  const filters = useMemo<AssetFilters>(
    () => ({ search: debouncedSearch, status, asset_type: assetType, sort }),
    [assetType, debouncedSearch, sort, status]
  );
  const assetsQuery = useQuery({
    queryKey: ["assets", filters],
    queryFn: () => apiClient.getAssets(token!, filters),
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (!selectedAssetId && assetsQuery.data?.length) {
      setSelectedAssetId(assetsQuery.data[0].id);
    }
  }, [assetsQuery.data, selectedAssetId]);

  const selectedAsset = assetsQuery.data?.find((asset) => asset.id === selectedAssetId) ?? null;
  const detailQuery = useQuery({
    queryKey: ["asset-detail", selectedAssetId],
    queryFn: () => apiClient.getAssetDetail(token!, selectedAssetId!),
    enabled: Boolean(token && selectedAssetId)
  });

  return (
    <div className="space-y-5">
      <section className="border border-white/10 bg-ink-850 p-5 shadow-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Asset Operations</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Monitored Assets</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Search personnel, vehicles, sensors, and gateways with enough context to explain
              which assets need attention and why.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_140px_140px_140px] xl:w-[760px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, call sign, zone"
                className="h-11 w-full border border-white/10 bg-ink-950 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-signal-cyan"
              />
            </label>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AssetFilters["status"])}
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              {assetStatuses.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? value : "all status"}
                </option>
              ))}
            </select>

            <select
              value={assetType}
              onChange={(event) => setAssetType(event.target.value as AssetFilters["asset_type"])}
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              {assetTypes.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? value : "all types"}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as AssetFilters["sort"])}
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              <option value="name">name</option>
              <option value="status">status</option>
              <option value="battery">battery</option>
              <option value="last_seen">last seen</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border border-white/10 bg-ink-850 shadow-panel">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-signal-cyan" />
              <h3 className="font-semibold text-white">Asset Table</h3>
            </div>
            <StatusBadge value={`${assetsQuery.data?.length ?? 0} shown`} tone="cyan" />
          </div>

          {assetsQuery.isLoading ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <tbody className="divide-y divide-white/10">
                  {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
                </tbody>
              </table>
            </div>
          ) : assetsQuery.isError ? (
            <div className="p-6 text-sm text-signal-red">Asset records are unavailable.</div>
          ) : assetsQuery.data?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Asset</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Zone</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Battery</th>
                    <th className="px-5 py-3 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {assetsQuery.data.map((asset) => (
                    <AssetRow
                      key={asset.id}
                      asset={asset}
                      isSelected={asset.id === selectedAssetId}
                      onSelect={() => setSelectedAssetId(asset.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-[220px] place-items-center p-6 text-sm text-slate-400">
              No assets match the current filters.
            </div>
          )}
        </div>

        <aside className="border border-white/10 bg-ink-850 shadow-panel">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <h3 className="font-semibold text-white">Asset Detail</h3>
            {selectedAsset ? (
              <button
                type="button"
                onClick={() => setSelectedAssetId(null)}
                className="grid h-8 w-8 place-items-center border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                aria-label="Clear selected asset"
                title="Clear selected asset"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {!selectedAssetId ? (
            <div className="p-5 text-sm text-slate-400">Select an asset to inspect state and history.</div>
          ) : detailQuery.isLoading ? (
            <AssetDetailSkeleton />
          ) : detailQuery.isError || !detailQuery.data ? (
            <div className="p-5 text-sm text-signal-red">Asset detail is unavailable.</div>
          ) : (
            <div className="space-y-5 p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      {detailQuery.data.call_sign}
                    </p>
                    <h4 className="mt-2 text-xl font-semibold text-white">{detailQuery.data.name}</h4>
                  </div>
                  <StatusBadge
                    value={detailQuery.data.status}
                    tone={assetStatusTone[detailQuery.data.status]}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <DetailStat icon={Radar} label="Zone" value={detailQuery.data.zone} />
                  <DetailStat icon={BatteryCharging} label="Battery" value={`${detailQuery.data.battery_level}%`} />
                  <DetailStat icon={Signal} label="Type" value={detailQuery.data.asset_type} />
                  <DetailStat label="Last seen" value={formatRelativeTime(detailQuery.data.last_seen_at)} />
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Metadata</p>
                <div className="mt-3 grid gap-2">
                  {metadataEntries(detailQuery.data.metadata).map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 border border-white/10 bg-ink-950 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-500">{item.key.replace("_", " ")}</span>
                      <span className="text-right text-slate-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Recent Events</p>
                <div className="mt-3 space-y-3">
                  {detailQuery.data.recent_events.map((event) => (
                    <article key={event.id} className="border border-white/10 bg-ink-950 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge value={event.severity} tone={severityTone[event.severity]} />
                        <span className="text-xs text-slate-500">{formatRelativeTime(event.occurred_at)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-slate-300">{event.message}</p>
                    </article>
                  ))}
                  {!detailQuery.data.recent_events.length ? (
                    <p className="text-sm text-slate-500">No recent events for this asset.</p>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Related Incidents</p>
                <div className="mt-3 space-y-3">
                  {detailQuery.data.related_incidents.map((incident) => (
                    <article key={incident.id} className="border border-white/10 bg-ink-950 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="text-sm font-semibold text-white">{incident.title}</h5>
                        <StatusBadge value={incident.status} tone={incidentStatusTone[incident.status]} />
                      </div>
                      <p className="mt-2 text-sm leading-5 text-slate-400">{incident.summary}</p>
                    </article>
                  ))}
                  {!detailQuery.data.related_incidents.length ? (
                    <p className="text-sm text-slate-500">No incidents currently reference this asset.</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function AssetRow({
  asset,
  isSelected,
  onSelect
}: {
  asset: Asset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      className={`cursor-pointer transition ${
        isSelected ? "bg-signal-cyan/10" : "hover:bg-white/[0.03]"
      }`}
      onClick={onSelect}
    >
      <td className="px-5 py-4">
        <p className="font-medium text-white">{asset.name}</p>
        <p className="text-xs text-slate-500">{asset.call_sign}</p>
      </td>
      <td className="px-5 py-4 text-slate-300">{asset.asset_type}</td>
      <td className="px-5 py-4 text-slate-300">{asset.zone}</td>
      <td className="px-5 py-4">
        <StatusBadge value={asset.status} tone={assetStatusTone[asset.status]} />
      </td>
      <td className="px-5 py-4 text-slate-300">{asset.battery_level}%</td>
      <td className="px-5 py-4 text-slate-400">{formatRelativeTime(asset.last_seen_at)}</td>
    </tr>
  );
}

function DetailStat({
  icon: Icon,
  label,
  value
}: {
  icon?: typeof Radar;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-white/10 bg-ink-950 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
