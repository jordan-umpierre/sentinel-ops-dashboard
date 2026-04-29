import { Activity, Bell, Boxes, ClipboardList, LayoutDashboard, LogOut, Map, Radio } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { LiveEventToast } from "../components/LiveEventToast";
import { useAuth } from "../features/auth/useAuth";
import { LiveEventsProvider } from "../features/realtime/LiveEventsContext";
import { useLiveEvents } from "../features/realtime/useLiveEvents";

const navigation = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Assets", href: "/assets", icon: Boxes },
  { label: "Incidents", href: "/incidents", icon: Bell },
  { label: "Site", href: "/site", icon: Map },
  { label: "Events", href: "/events", icon: ClipboardList }
];

export function AppShell() {
  return (
    <LiveEventsProvider>
      <AppShellContent />
    </LiveEventsProvider>
  );
}

function AppShellContent() {
  const { user, logout } = useAuth();
  const { connectionStatus, liveEvents } = useLiveEvents();
  // Always pass the most recent live event so the toast reacts to new arrivals.
  const latestEvent = liveEvents[0] ?? null;

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-ink-900 lg:block">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="grid h-10 w-10 place-items-center border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Sentinel</p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ops Console</p>
            </div>
          </div>

          <nav className="space-y-1 px-3 py-5" aria-label="Primary navigation">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === "/"}
                  className={({ isActive }) =>
                    [
                      "flex h-11 items-center gap-3 px-3 text-sm font-medium transition",
                      isActive
                        ? "border border-signal-cyan/30 bg-signal-cyan/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    ].join(" ")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between border-b border-white/10 bg-ink-950/92 px-4 backdrop-blur md:px-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                <Activity className="h-4 w-4 text-signal-green" />
                Live Readiness
              </div>
              <h1 className="mt-1 truncate text-xl font-semibold text-white md:text-2xl">
                Operational Awareness
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <LiveStatus status={connectionStatus} />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white">{user?.full_name}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{user?.role}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="grid h-10 w-10 place-items-center border border-white/10 bg-white/5 text-slate-300 transition hover:border-signal-red/60 hover:text-white"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          <nav
            className="grid grid-cols-5 border-b border-white/10 bg-ink-900 lg:hidden"
            aria-label="Mobile navigation"
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === "/"}
                  className={({ isActive }) =>
                    [
                      "grid h-14 place-items-center text-slate-500 transition",
                      isActive ? "bg-signal-cyan/10 text-signal-cyan" : "hover:bg-white/5 hover:text-white"
                    ].join(" ")
                  }
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon className="h-5 w-5" />
                </NavLink>
              );
            })}
          </nav>

          <main className="flex-1 px-4 py-6 md:px-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Portal-style toast rendered outside the scroll container so it always
          appears at the viewport bottom-right regardless of scroll position */}
      <LiveEventToast latestEvent={latestEvent} />
    </div>
  );
}

function LiveStatus({ status }: { status: string }) {
  const isLive = status === "live";

  return (
    <div
      className={`hidden h-9 items-center gap-2 border px-3 text-xs font-semibold uppercase tracking-[0.16em] md:flex ${
        isLive
          ? "border-signal-green/30 bg-signal-green/10 text-signal-green"
          : "border-signal-amber/30 bg-signal-amber/10 text-signal-amber"
      }`}
      title="Realtime simulator connection"
    >
      {/* Pulsing dot gives operators an immediate at-a-glance signal that the
          stream is alive, without requiring them to watch the event feed */}
      <span
        className={`h-2 w-2 ${
          isLive ? "animate-status-pulse bg-signal-green" : "bg-signal-amber"
        }`}
      />
      {status}
    </div>
  );
}
