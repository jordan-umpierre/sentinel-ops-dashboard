import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Map,
  RadioTower,
  ShieldAlert
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { MetricCard } from "../../components/MetricCard";
import { StatusBadge } from "../../components/StatusBadge";
import { apiClient } from "../../lib/api";
import { formatRelativeTime } from "../../lib/date";
import { assetStatusTone, incidentStatusTone, severityTone } from "../../lib/tones";
import { useAuth } from "../auth/useAuth";

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

  // Dashboard summaries are derived from the same data shown in the detail
  // workspaces. That keeps the first screen honest and makes drill-downs easy to
  // explain: every count has visible evidence behind it.
  const assetStatusCounts = data.assets.reduce(
    (counts, asset) => ({
      ...counts,
      [asset.status]: counts[asset.status] + 1
    }),
    { nominal: 0, watch: 0, alert: 0, offline: 0 }
  );
  const severityCounts = data.recent_events.reduce(
    (counts, event) => ({
      ...counts,
      [event.severity]: counts[event.severity] + 1
    }),
    { info: 0, low: 0, medium: 0, high: 0, critical: 0 }
  );
  const attentionAssets = data.assets.filter((asset) => asset.status !== "nominal").slice(0, 4);
  const latestIncident = data.incidents[0];

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
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <DashboardLink to="/incidents" label="Open triage" icon={ShieldAlert} />
            <DashboardLink to="/site" label="View site" icon={Map} />
          </div>
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

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="border border-white/10 bg-ink-850 p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Asset Distribution</p>
              <h3 className="mt-2 font-semibold text-white">Status Breakdown</h3>
            </div>
            <DashboardLink to="/assets" label="Assets" icon={Boxes} compact />
          </div>
          <div className="mt-5 space-y-3">
            <StatusBar label="Nominal" value={assetStatusCounts.nominal} total={data.assets.length} tone="green" />
            <StatusBar label="Watch" value={assetStatusCounts.watch} total={data.assets.length} tone="amber" />
            <StatusBar label="Alert" value={assetStatusCounts.alert} total={data.assets.length} tone="red" />
            <StatusBar label="Offline" value={assetStatusCounts.offline} total={data.assets.length} tone="neutral" />
          </div>
        </div>

        <div className="border border-white/10 bg-ink-850 p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent Signal Mix</p>
              <h3 className="mt-2 font-semibold text-white">Event Severity</h3>
            </div>
            <DashboardLink to="/events" label="History" icon={Clock3} compact />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            {Object.entries(severityCounts).map(([severity, count]) => (
              <div key={severity} className="border border-white/10 bg-ink-950 p-3">
                <StatusBadge value={severity} tone={severityTone[severity as keyof typeof severityTone]} />
                <p className="mt-3 text-2xl font-semibold text-white">{count}</p>
                <p className="mt-1 text-xs text-slate-500">recent events</p>
              </div>
            ))}
          </div>
        </div>
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
                    <StatusBadge value={incident.status} tone={incidentStatusTone[incident.status]} />
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

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="border border-white/10 bg-ink-850 shadow-panel">
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <h3 className="font-semibold text-white">Attention Queue</h3>
            <Activity className="h-4 w-4 text-signal-amber" />
          </div>
          <div className="divide-y divide-white/10">
            {attentionAssets.map((asset) => (
              <article key={asset.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-white">{asset.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {asset.call_sign} / {asset.zone}
                  </p>
                </div>
                <StatusBadge value={asset.status} tone={assetStatusTone[asset.status]} />
              </article>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-ink-850 p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current Priority</p>
          {latestIncident ? (
            <>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-semibold text-white">{latestIncident.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{latestIncident.summary}</p>
                </div>
                <StatusBadge value={latestIncident.severity} tone={severityTone[latestIncident.severity]} />
              </div>
              <Link
                to="/incidents"
                className="mt-5 inline-flex h-10 items-center gap-2 border border-signal-cyan/40 bg-signal-cyan/10 px-3 text-sm font-semibold text-signal-cyan transition hover:bg-signal-cyan/20"
              >
                Review incident <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No incidents require operator action.</p>
          )}
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
                    <StatusBadge value={asset.status} tone={assetStatusTone[asset.status]} />
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

function DashboardLink({
  to,
  label,
  icon: Icon,
  compact = false
}: {
  to: string;
  label: string;
  icon: typeof ShieldAlert;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-200 transition hover:border-signal-cyan/50 hover:text-white ${
        compact ? "h-9 px-3" : "h-10 px-3"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function StatusBar({
  label,
  value,
  total,
  tone
}: {
  label: string;
  value: number;
  total: number;
  tone: "neutral" | "green" | "amber" | "red";
}) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  const fillClass = {
    neutral: "bg-slate-500",
    green: "bg-signal-green",
    amber: "bg-signal-amber",
    red: "bg-signal-red"
  }[tone];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-medium text-white">{value}</span>
      </div>
      <div className="h-2 border border-white/10 bg-ink-950">
        <div className={`h-full ${fillClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
