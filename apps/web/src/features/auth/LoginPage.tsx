import { FormEvent, useState } from "react";
import { LockKeyhole, Radio, ShieldCheck } from "lucide-react";

import { useAuth } from "./useAuth";

const demoAccounts = [
  { label: "Operator", email: "operator@sentinel.dev" },
  { label: "Admin", email: "admin@sentinel.dev" },
  { label: "Viewer", email: "viewer@sentinel.dev" },
];

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("operator@sentinel.dev");
  const [password, setPassword] = useState("sentinel123");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch {
      setError("Invalid credentials. Use a seeded demo account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-ink-950 text-slate-100">

      {/* ── LEFT: tactical briefing panel ── */}
      <section
        className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-ink-900 px-12 py-10 lg:flex"
        style={{
          width: "58%",
          backgroundImage:
            "linear-gradient(rgba(56,216,216,0.028) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(56,216,216,0.028) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      >
        {/* animated scan line */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-scan absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-signal-cyan/25 to-transparent" />
        </div>

        {/* top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-signal-cyan/30 bg-signal-cyan/[0.07]">
              <Radio className="h-5 w-5 text-signal-cyan" />
            </div>
            <div>
              <p className="font-display text-xl font-bold uppercase tracking-[0.14em] text-white">
                Sentinel
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal-cyan/60">
                Ops Console
              </p>
            </div>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
            Unclassified&nbsp;//&nbsp;Demo
          </p>
        </div>

        {/* headline block */}
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.34em] text-signal-cyan">
            Northstar Secure Logistics Hub
          </p>
          <h1 className="mt-5 font-display text-[5.25rem] font-black uppercase leading-[0.88] tracking-[-0.01em] text-white">
            Total<br />Operational<br />Awareness
          </h1>
          <p className="mt-7 max-w-md text-[0.875rem] leading-[1.8] text-slate-400">
            Monitor active incidents, asset health, site conditions, and
            audit-ready event context from one focused command surface.
          </p>
        </div>

        {/* stat strip */}
        <div
          className="flex divide-x divide-white/[0.08] border border-white/[0.08] bg-white/[0.02]"
        >
          {[
            { value: "5",  label: "Monitored Assets" },
            { value: "1",  label: "Active Incident"  },
            { value: "3",  label: "Access Roles"     },
            { value: "8s", label: "Event Cadence"    },
          ].map((stat) => (
            <div key={stat.label} className="flex-1 px-5 py-5">
              <p className="font-display text-4xl font-black text-white">
                {stat.value}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── RIGHT: auth form ── */}
      <section className="flex flex-1 flex-col items-center justify-center bg-ink-950 px-8 py-16">

        {/* mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="grid h-10 w-10 place-items-center border border-signal-cyan/30 bg-signal-cyan/[0.07]">
            <Radio className="h-5 w-5 text-signal-cyan" />
          </div>
          <div>
            <p className="font-display text-xl font-bold uppercase tracking-[0.14em] text-white">Sentinel</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal-cyan/60">Ops Console</p>
          </div>
        </div>

        {/* card with corner brackets */}
        <div className="relative w-full max-w-[380px]">
          <span className="pointer-events-none absolute -left-2 -top-2 h-5 w-5 border-l border-t border-signal-cyan/35" />
          <span className="pointer-events-none absolute -right-2 -top-2 h-5 w-5 border-r border-t border-signal-cyan/35" />
          <span className="pointer-events-none absolute -bottom-2 -left-2 h-5 w-5 border-b border-l border-signal-cyan/35" />
          <span className="pointer-events-none absolute -bottom-2 -right-2 h-5 w-5 border-b border-r border-signal-cyan/35" />

          <form
            onSubmit={handleSubmit}
            className="border border-white/[0.09] bg-ink-850 px-8 py-9 shadow-panel"
          >
            {/* form header */}
            <div className="flex items-center gap-3 border-b border-white/[0.07] pb-6">
              <div className="grid h-9 w-9 place-items-center border border-signal-green/30 bg-signal-green/[0.07]">
                <ShieldCheck className="h-4 w-4 text-signal-green" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold uppercase tracking-[0.1em] text-white">
                  Secure Access
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
                  Credential Verification
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400">
                  Identifier
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 h-11 w-full border border-white/10 bg-ink-950 px-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-signal-cyan"
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400">
                  Passphrase
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-11 w-full border border-white/10 bg-ink-950 px-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-signal-cyan"
                  autoComplete="current-password"
                />
              </label>
            </div>

            {error ? (
              <div className="mt-4 border-l-2 border-signal-red bg-signal-red/[0.07] px-3 py-2 font-mono text-xs text-signal-red">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 bg-signal-cyan font-display text-sm font-bold uppercase tracking-[0.16em] text-ink-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LockKeyhole className="h-4 w-4" />
              {isSubmitting ? "Authenticating…" : "Enter Console"}
            </button>

            <div className="mt-6">
              <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.26em] text-slate-600">
                Demo Access
              </p>
              <div className="grid grid-cols-3 gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword("sentinel123");
                    }}
                    className="border border-white/[0.08] bg-white/[0.02] px-2 py-2.5 text-left transition hover:border-signal-cyan/40 hover:bg-signal-cyan/[0.04]"
                  >
                    <span className="block font-display text-xs font-bold uppercase tracking-[0.1em] text-white">
                      {account.label}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-slate-500">
                      {account.email.split("@")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
