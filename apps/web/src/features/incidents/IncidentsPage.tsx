import {
  BrainCircuit,
  CheckCircle2,
  Clock3,
  ListFilter,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { IncidentDetailSkeleton, IncidentRowSkeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { apiClient, type IncidentFilters, type IncidentListItem, type IncidentStatus } from "../../lib/api";
import { formatRelativeTime } from "../../lib/date";
import { useDebounce } from "../../lib/useDebounce";
import { assetStatusTone, incidentStatusTone, severityTone } from "../../lib/tones";
import { useAuth } from "../auth/useAuth";

const incidentStatuses = ["", "open", "acknowledged", "resolved"] as const;
const severities = ["", "info", "low", "medium", "high", "critical"] as const;

// Valid next-status transitions for each current status.
// This mirrors the backend lifecycle model and drives which action buttons render.
const nextStatuses: Record<IncidentStatus, IncidentStatus[]> = {
  open: ["acknowledged"],
  acknowledged: ["resolved", "open"],
  resolved: ["open"]
};

export function IncidentsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<IncidentFilters["status"]>("");
  const [severity, setSeverity] = useState<IncidentFilters["severity"]>("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const filters = useMemo<IncidentFilters>(
    () => ({ search: debouncedSearch, status, severity }),
    [debouncedSearch, severity, status]
  );
  const incidentsQuery = useQuery({
    queryKey: ["incidents", filters],
    queryFn: () => apiClient.getIncidents(token!, filters),
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (!incidentsQuery.data?.length) return;
    const stillInList =
      selectedIncidentId &&
      incidentsQuery.data.some((incident) => incident.id === selectedIncidentId);
    if (!stillInList) {
      setSelectedIncidentId(incidentsQuery.data[0].id);
    }
  }, [incidentsQuery.data, selectedIncidentId]);

  const detailQuery = useQuery({
    queryKey: ["incident-detail", selectedIncidentId],
    queryFn: () => apiClient.getIncidentDetail(token!, selectedIncidentId!),
    enabled: Boolean(token && selectedIncidentId)
  });

  const summaryQuery = useQuery({
    queryKey: ["incident-summary", selectedIncidentId],
    queryFn: () => apiClient.getIncidentSummary(token!, selectedIncidentId!),
    enabled: Boolean(token && selectedIncidentId),
    // Summaries are generated on demand and don't change with live events,
    // so a 5-minute stale window avoids unnecessary re-generation.
    staleTime: 5 * 60 * 1000
  });

  // Mutation for status transitions — invalidates both the list and detail caches
  // so every visible incident card reflects the updated state immediately.
  const statusMutation = useMutation({
    mutationFn: ({ incidentId, nextStatus }: { incidentId: string; nextStatus: IncidentStatus }) =>
      apiClient.updateIncidentStatus(token!, incidentId, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident-detail", selectedIncidentId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      // Status change also invalidates the backend summary cache, so clear the
      // React Query cache too — the next render will fetch a fresh generation.
      queryClient.removeQueries({ queryKey: ["incident-summary", selectedIncidentId] });
    }
  });

  // Summary refresh mutation — calls the backend with ?refresh=true to bypass
  // the DB cache and writes the fresh result directly into the React Query cache
  // so the UI updates without a full refetch cycle.
  const refreshSummaryMutation = useMutation({
    mutationFn: () => apiClient.getIncidentSummary(token!, selectedIncidentId!, true),
    onSuccess: (data) => {
      queryClient.setQueryData(["incident-summary", selectedIncidentId], data);
    }
  });

  // Viewers are read-only — the backend enforces this too, but hiding the
  // buttons avoids a misleading UX for accounts without write access.
  const canMutate = user?.role === "operator" || user?.role === "admin";

  return (
    <div className="space-y-5">
      <section className="border border-white/10 bg-ink-850 p-5 shadow-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Incident Triage</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Active Incident Review</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Review correlated incidents, inspect linked evidence, and explain why the alert fired
              from the same operator workspace.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_150px_150px] xl:w-[620px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, summary, explanation"
                className="h-11 w-full border border-white/10 bg-ink-950 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-signal-cyan"
              />
            </label>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as IncidentFilters["status"])}
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              {incidentStatuses.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? value : "all status"}
                </option>
              ))}
            </select>

            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as IncidentFilters["severity"])}
              className="h-11 border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none focus:border-signal-cyan"
            >
              {severities.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? value : "all severity"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="border border-white/10 bg-ink-850 shadow-panel">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-signal-cyan" />
              <h3 className="font-semibold text-white">Incident Queue</h3>
            </div>
            <StatusBadge value={`${incidentsQuery.data?.length ?? 0} shown`} tone="cyan" />
          </div>

          {incidentsQuery.isLoading ? (
            <div className="divide-y divide-white/10">
              {Array.from({ length: 4 }).map((_, i) => <IncidentRowSkeleton key={i} />)}
            </div>
          ) : incidentsQuery.isError ? (
            <div className="p-5 text-sm text-signal-red">Incident records are unavailable.</div>
          ) : incidentsQuery.data?.length ? (
            <div className="divide-y divide-white/10">
              {incidentsQuery.data.map((incident) => (
                <IncidentQueueItem
                  key={incident.id}
                  incident={incident}
                  isSelected={incident.id === selectedIncidentId}
                  onSelect={() => setSelectedIncidentId(incident.id)}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-[220px] place-items-center p-6 text-sm text-slate-400">
              No incidents match the current filters.
            </div>
          )}
        </div>

        <div className="space-y-5">
          {detailQuery.isLoading ? (
            <IncidentDetailSkeleton />
          ) : detailQuery.isError || !detailQuery.data ? (
            <div className="border border-signal-red/30 bg-signal-red/10 p-5 text-sm text-signal-red">
              Select an incident to inspect the triage packet.
            </div>
          ) : (
            <>
              <section className="border border-white/10 bg-ink-850 p-5 shadow-panel">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      {formatRelativeTime(detailQuery.data.created_at)}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{detailQuery.data.title}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                      {detailQuery.data.summary}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge
                      value={detailQuery.data.severity}
                      tone={severityTone[detailQuery.data.severity]}
                    />
                    <StatusBadge
                      value={detailQuery.data.status}
                      tone={incidentStatusTone[detailQuery.data.status]}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <IncidentStat icon={ShieldAlert} label="Severity" value={detailQuery.data.severity} />
                  <IncidentStat
                    icon={Clock3}
                    label="Related events"
                    value={String(detailQuery.data.related_event_count)}
                  />
                  <IncidentStat
                    icon={CheckCircle2}
                    label="Affected assets"
                    value={String(detailQuery.data.affected_assets.length)}
                  />
                </div>

                {/* Status action buttons — visible only to operator and admin roles */}
                {canMutate && (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                    <p className="mr-2 flex items-center text-xs uppercase tracking-[0.18em] text-slate-500">
                      Transition
                    </p>
                    {nextStatuses[detailQuery.data.status as IncidentStatus].map((nextStatus) => (
                      <IncidentActionButton
                        key={nextStatus}
                        nextStatus={nextStatus}
                        isLoading={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            incidentId: detailQuery.data.id,
                            nextStatus
                          })
                        }
                      />
                    ))}
                    {statusMutation.isError && (
                      <p className="text-xs text-signal-red">Status update failed — try again.</p>
                    )}
                  </div>
                )}
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="border border-white/10 bg-ink-850 shadow-panel">
                  <div className="border-b border-white/10 px-5 py-4">
                    <h3 className="font-semibold text-white">Why This Alert Fired</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{detailQuery.data.explanation}</p>
                  </div>

                  <div className="divide-y divide-white/10">
                    {detailQuery.data.related_events.map((event) => (
                      <article key={event.id} className="grid gap-4 p-5 md:grid-cols-[140px_1fr]">
                        <div>
                          <StatusBadge value={event.severity} tone={severityTone[event.severity]} />
                          <p className="mt-2 text-xs text-slate-500">
                            {formatRelativeTime(event.occurred_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{event.message}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {event.source} / {event.zone}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <aside className="space-y-5">
                  <section className="border border-white/10 bg-ink-850 p-5 shadow-panel">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-signal-cyan" />
                        <h3 className="font-semibold text-white">Incident Summary</h3>
                      </div>
                      {summaryQuery.data && (
                        <button
                          type="button"
                          onClick={() => refreshSummaryMutation.mutate()}
                          disabled={refreshSummaryMutation.isPending}
                          className="inline-flex items-center gap-1.5 border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          title="Force regenerate summary, bypassing cache"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {refreshSummaryMutation.isPending ? "Refreshing..." : "Refresh"}
                        </button>
                      )}
                    </div>
                    {summaryQuery.isLoading ? (
                      <p className="mt-4 text-sm text-slate-400">Generating summary...</p>
                    ) : summaryQuery.isError || !summaryQuery.data ? (
                      <p className="mt-4 text-sm text-signal-red">Summary provider unavailable.</p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={summaryQuery.data.provider} tone="cyan" />
                          {summaryQuery.data.cached_at ? (
                            <StatusBadge value="cached" tone="neutral" />
                          ) : (
                            <StatusBadge value="live" tone="green" />
                          )}
                        </div>
                        <p className="text-sm leading-6 text-slate-300">{summaryQuery.data.summary}</p>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Likely cause</p>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {summaryQuery.data.likely_cause}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Next checks</p>
                          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-400">
                            {summaryQuery.data.suggested_next_checks.map((check) => (
                              <li key={check} className="border border-white/10 bg-ink-950 px-3 py-2">
                                {check}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="border border-white/10 bg-ink-850 p-5 shadow-panel">
                    <h3 className="font-semibold text-white">Affected Assets</h3>
                    <div className="mt-4 space-y-3">
                      {detailQuery.data.affected_asset_details.map((asset) => (
                        <article key={asset.id} className="border border-white/10 bg-ink-950 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">{asset.name}</p>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                {asset.call_sign} / {asset.zone}
                              </p>
                            </div>
                            <StatusBadge value={asset.status} tone={assetStatusTone[asset.status]} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </aside>
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// Labels and icons for each target status — drives the action button appearance.
const statusActionConfig: Record<
  IncidentStatus,
  { label: string; icon: typeof ShieldCheck; tone: string }
> = {
  acknowledged: {
    label: "Acknowledge",
    icon: ShieldCheck,
    tone: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber hover:bg-signal-amber/20"
  },
  resolved: {
    label: "Mark Resolved",
    icon: CheckCircle2,
    tone: "border-signal-green/40 bg-signal-green/10 text-signal-green hover:bg-signal-green/20"
  },
  open: {
    label: "Reopen",
    icon: RotateCcw,
    tone: "border-signal-red/40 bg-signal-red/10 text-signal-red hover:bg-signal-red/20"
  }
};

function IncidentActionButton({
  nextStatus,
  isLoading,
  onClick
}: {
  nextStatus: IncidentStatus;
  isLoading: boolean;
  onClick: () => void;
}) {
  const config = statusActionConfig[nextStatus];
  const Icon = config.icon;

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${config.tone}`}
    >
      <Icon className="h-4 w-4" />
      {isLoading ? "Updating..." : config.label}
    </button>
  );
}

function IncidentQueueItem({
  incident,
  isSelected,
  onSelect
}: {
  incident: IncidentListItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full p-5 text-left transition ${
        isSelected ? "bg-signal-cyan/10" : "hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold leading-5 text-white">{incident.title}</h4>
        <StatusBadge value={incident.severity} tone={severityTone[incident.severity]} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{incident.summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge value={incident.status} tone={incidentStatusTone[incident.status]} />
        <span className="text-xs text-slate-500">{incident.related_event_count} linked events</span>
      </div>
    </button>
  );
}

function IncidentStat({
  icon: Icon,
  label,
  value
}: {
  icon: typeof ShieldAlert;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-white/10 bg-ink-950 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
