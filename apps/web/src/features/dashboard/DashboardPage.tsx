import { AlertTriangle, Boxes, CheckCircle2, RadioTower, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { MetricCard } from "../../components/MetricCard";
import { StatusBadge } from "../../components/StatusBadge";
import { apiClient } from "../../lib/api";
import { formatRelativeTime } from "../../lib/date";
import { useAuth } from "../auth/useAuth";

const severityTone = {
  info: "cyan",
  low: "green",
  medium: "amber",
  high: "red",
  critical: "red"
} as const;

const statusTone = {
  nominal: "green",
  watch: "amber",
  alert: "red",
  offline: "neutral",
  open: "red",
  acknowledged: "amber",
  resolved: "green"
} as const;

export function DashboardPage() {
  const { token } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => apiClient.getDashboardOverview(token!),
    enabled: Boolean(token)
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[420px] place-items-center border border-white/10 bg-ink-850 text-sm text-slate-400">
        Loading operational snapshot...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="border border-signal-red/30 bg-signal-red/10 p-5 text-sm text-signal-red">
        Dashboard data is unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="border border-white/10 bg-ink-850 p-5 shadow-panel">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{data.site.code}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{data.site.name}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{data.site.description}</p>
            </div>
            <div className="border border-signal-green/30 bg-signal-green/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-signal-green">System Health</p>
              <p className="mt-1 text-2xl font-semibold text-white">{data.metrics.system_health_percent}%</p>
            </div>
          </div>
        </div>

        <div className="border border-white/10 bg-ink-850 p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Operator Focus</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Triage the North Gate anomaly, confirm Patrol Alpha position, and dispatch maintenance to Cold Storage.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Incidents"
          value={data.metrics.active_incidents}
          detail="Open or acknowledged incidents"
          icon={ShieldAlert}
          tone="red"
        />
        <MetricCard
          label="High Events"
          value={data.metrics.critical_events_today}
          detail="High and critical events in current view"
          icon={AlertTriangle}
          tone="amber"
        />
        <MetricCard
          label="Assets"
          value={data.metrics.assets_monitored}
          detail="Personnel, vehicles, sensors, gateways"
          icon={Boxes}
          tone="cyan"
        />
        <MetricCard
          label="In Alert"
          value={data.metrics.assets_in_alert}
          detail="Assets requiring operator attention"
          icon={RadioTower}
          tone="green"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="border border-white/10 bg-ink-850 shadow-panel">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <h3 className="font-semibold text-white">Active Incidents</h3>
            <StatusBadge value={`${data.incidents.length} tracked`} tone="cyan" />
          </div>
          <div className="divide-y divide-white/10">
            {data.incidents.map((incident) => (
              <article key={incident.id} className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{incident.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{incident.summary}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <StatusBadge value={incident.severity} tone={severityTone[incident.severity]} />
                    <StatusBadge value={incident.status} tone={statusTone[incident.status]} />
                  </div>
                </div>
                <div className="mt-4 border border-white/10 bg-ink-950 p-3 text-sm leading-6 text-slate-400">
                  {incident.explanation}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-ink-850 shadow-panel">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <h3 className="font-semibold text-white">Recent Event Stream</h3>
            <CheckCircle2 className="h-4 w-4 text-signal-green" />
          </div>
          <div className="divide-y divide-white/10">
            {data.recent_events.map((event) => (
              <article key={event.id} className="grid gap-3 p-4 sm:grid-cols-[120px_1fr]">
                <div className="space-y-2">
                  <StatusBadge value={event.severity} tone={severityTone[event.severity]} />
                  <p className="text-xs text-slate-500">{formatRelativeTime(event.occurred_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{event.message}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {event.source} / {event.zone}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border border-white/10 bg-ink-850 shadow-panel">
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
          <h3 className="font-semibold text-white">Asset Status</h3>
          <StatusBadge value="seeded demo data" tone="neutral" />
        </div>
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
              {data.assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{asset.name}</p>
                    <p className="text-xs text-slate-500">{asset.call_sign}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{asset.asset_type}</td>
                  <td className="px-5 py-4 text-slate-300">{asset.zone}</td>
                  <td className="px-5 py-4">
                    <StatusBadge value={asset.status} tone={statusTone[asset.status]} />
                  </td>
                  <td className="px-5 py-4 text-slate-300">{asset.battery_level}%</td>
                  <td className="px-5 py-4 text-slate-400">{formatRelativeTime(asset.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
