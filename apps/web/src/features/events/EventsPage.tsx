import { ChevronLeft, ChevronRight, ClipboardList, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "../../components/StatusBadge";
import { apiClient, type EventFilters } from "../../lib/api";
import { formatRelativeTime } from "../../lib/date";
import { useDebounce } from "../../lib/useDebounce";
import { severityTone } from "../../lib/tones";
import { useAuth } from "../auth/useAuth";

const severities = ["", "info", "low", "medium", "high", "critical"] as const;
const eventTypes = [
  "",
  "access_denied",
  "geofence_breach",
  "equipment_offline",
  "temperature_threshold",
  "sensor_heartbeat",
  "route_deviation"
] as const;

export function EventsPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [assetId, setAssetId] = useState("");
  const [severity, setSeverity] = useState<EventFilters["severity"]>("");
  const [eventType, setEventType] = useState<EventFilters["event_type"]>("");
  const [sinceHours, setSinceHours] = useState<EventFilters["since_hours"]>("");
  const [sort, setSort] = useState<EventFilters["sort"]>("newest");
  const [page, setPage] = useState(1);

  // The assets query powers the asset filter. Reusing the same API client keeps
  // Phase 2 frontend state simple without introducing a global store.
  const assetsQuery = useQuery({
    queryKey: ["assets", "event-filter"],
    queryFn: () => apiClient.getAssets(token!, { sort: "name" }),
    enabled: Boolean(token)
  });

  // Debounce the free-text search; the select-based filters are discrete and
  // don't need it. Pagination resets to page 1 only on user-initiated changes
  // (handled in the onChange callbacks), not when the debounce fires.
  const debouncedSearch = useDebounce(search, 300);

  const filters = useMemo<EventFilters>(
    () => ({
      search: debouncedSearch,
      asset_id: assetId,
      severity,
      event_type: eventType,
      since_hours: sinceHours,
      sort,
      page,
      page_size: 8
    }),
    [assetId, debouncedSearch, eventType, page, severity, sinceHours, sort]
  );
  const eventsQuery = useQuery({
    queryKey: ["events", filters],
    queryFn: () => apiClient.getEvents(token!, filters),
    enabled: Boolean(token)
  });

  function resetToFirstPage(update: () => void) {
    // Resetting pagination when filters change prevents empty pages after an
    // operator narrows a query that previously had more results.
    update();
    setPage(1);
  }

  const pagination = eventsQuery.data?.pagination;
  const canGoBack = Boolean(pagination && pagination.page > 1);
  const canGoForward = Boolean(pagination && pagination.page < pagination.total_pages);

  return (
    <div className="space-y-5">
      <section className="border border-white/10 bg-ink-850 p-5 shadow-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Audit Trail</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Event History</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Search event history by message, source, asset, severity, and type while preserving
              the evidence trail behind operational decisions.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:w-[940px] xl:grid-cols-[minmax(220px,1fr)_140px_140px_160px_140px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => resetToFirstPage(() => setSearch(event.target.value))}
                placeholder="Search event text"
                className="h-11 w-full border border-white/10 bg-ink-950 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-signal-cyan"
              />
            </label>

            <select
              value={assetId}
              onChange={(event) => resetToFirstPage(() => setAssetId(event.target.value))}
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              <option value="">all assets</option>
              {assetsQuery.data?.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.call_sign}
                </option>
              ))}
            </select>

            <select
              value={severity}
              onChange={(event) =>
                resetToFirstPage(() => setSeverity(event.target.value as EventFilters["severity"]))
              }
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              {severities.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? value : "all severity"}
                </option>
              ))}
            </select>

            <select
              value={eventType}
              onChange={(event) =>
                resetToFirstPage(() => setEventType(event.target.value as EventFilters["event_type"]))
              }
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              {eventTypes.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? value.replace("_", " ") : "all types"}
                </option>
              ))}
            </select>

            <select
              value={sinceHours}
              onChange={(event) =>
                resetToFirstPage(() =>
                  setSinceHours(event.target.value ? Number(event.target.value) : "")
                )
              }
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              <option value="">all time</option>
              <option value="1">last hour</option>
              <option value="8">current shift</option>
              <option value="24">last day</option>
              <option value="168">last week</option>
            </select>
          </div>
        </div>
      </section>

      <section className="border border-white/10 bg-ink-850 shadow-panel">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-signal-cyan" />
            <h3 className="font-semibold text-white">Events</h3>
            {pagination ? <StatusBadge value={`${pagination.total} total`} tone="cyan" /> : null}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={sort}
              onChange={(event) =>
                resetToFirstPage(() => setSort(event.target.value as EventFilters["sort"]))
              }
              className="h-9 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              <option value="newest">newest first</option>
              <option value="oldest">oldest first</option>
            </select>
          </div>
        </div>

        {eventsQuery.isLoading ? (
          <div className="p-6 text-sm text-slate-400">Loading event history...</div>
        ) : eventsQuery.isError || !eventsQuery.data ? (
          <div className="p-6 text-sm text-signal-red">Event history is unavailable.</div>
        ) : eventsQuery.data.items.length ? (
          <div className="divide-y divide-white/10">
            {eventsQuery.data.items.map((event) => (
              <article key={event.id} className="grid gap-4 p-5 lg:grid-cols-[150px_1fr_220px]">
                <div>
                  <StatusBadge value={event.severity} tone={severityTone[event.severity]} />
                  <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(event.occurred_at)}</p>
                </div>

                <div>
                  <p className="text-sm font-medium leading-6 text-white">{event.message}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {event.event_type.replace("_", " ")}
                  </p>
                </div>

                <div className="lg:text-right">
                  <p className="text-sm text-slate-300">{event.asset_name ?? "Site systems"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {event.source} / {event.zone}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[260px] place-items-center p-6 text-sm text-slate-400">
            No events match the current filters.
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">
            Page {pagination?.page ?? 1} of {pagination?.total_pages ?? 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="grid h-9 w-9 place-items-center border border-white/10 bg-white/5 text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!canGoForward}
              onClick={() => setPage((current) => current + 1)}
              className="grid h-9 w-9 place-items-center border border-white/10 bg-white/5 text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
