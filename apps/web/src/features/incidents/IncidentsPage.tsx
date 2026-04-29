import { BrainCircuit, CheckCircle2, Clock3, ListFilter, Search, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "../../components/StatusBadge";
import { apiClient, type IncidentFilters, type IncidentListItem } from "../../lib/api";
import { formatRelativeTime } from "../../lib/date";
import { assetStatusTone, incidentStatusTone, severityTone } from "../../lib/tones";
import { useAuth } from "../auth/useAuth";

const incidentStatuses = ["", "open", "acknowledged", "resolved"] as const;
const severities = ["", "info", "low", "medium", "high", "critical"] as const;

export function IncidentsPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<IncidentFilters["status"]>("");
  const [severity, setSeverity] = useState<IncidentFilters["severity"]>("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Filters live in the query key so list state is shareable and easy to reason
  // about when explaining the frontend data flow in an interview.
  const filters = useMemo<IncidentFilters>(
    () => ({ search, status, severity }),
    [search, severity, status]
  );
  const incidentsQuery = useQuery({
    queryKey: ["incidents", filters],
    queryFn: () => apiClient.getIncidents(token!, filters),
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (!selectedIncidentId && incidentsQuery.data?.length) {
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
    enabled: Boolean(token && selectedIncidentId)
  });

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
            <div className="p-5 text-sm text-slate-400">Loading incidents...</div>
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
            <div className="border border-white/10 bg-ink-850 p-6 text-sm text-slate-400 shadow-panel">
              Loading incident detail...
            </div>
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
                  <IncidentStat icon={Clock3} label="Related events" value={String(detailQuery.data.related_event_count)} />
                  <IncidentStat icon={CheckCircle2} label="Affected assets" value={String(detailQuery.data.affected_assets.length)} />
                </div>
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
                          <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(event.occurred_at)}</p>
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
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4 text-signal-cyan" />
                      <h3 className="font-semibold text-white">Incident Summary</h3>
                    </div>
                    {summaryQuery.isLoading ? (
                      <p className="mt-4 text-sm text-slate-400">Generating summary...</p>
                    ) : summaryQuery.isError || !summaryQuery.data ? (
                      <p className="mt-4 text-sm text-signal-red">Summary provider unavailable.</p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <StatusBadge value={summaryQuery.data.provider} tone="cyan" />
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
