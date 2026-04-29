import { FormEvent, useState } from "react";
import { LockKeyhole, Radio, ShieldCheck } from "lucide-react";

import { useAuth } from "./useAuth";

const demoAccounts = [
  { label: "Operator", email: "operator@sentinel.dev" },
  { label: "Admin", email: "admin@sentinel.dev" },
  { label: "Viewer", email: "viewer@sentinel.dev" }
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
    <main className="grid min-h-screen bg-ink-950 text-slate-100 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex min-h-[52vh] flex-col justify-between border-b border-white/10 bg-ink-900 px-6 py-8 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-12">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center border border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-semibold text-white">Sentinel</p>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Ops Console</p>
          </div>
        </div>

        <div className="max-w-2xl py-12">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-signal-cyan">
            Northstar Secure Logistics Hub
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-6xl">
            Real-time operational awareness for critical site teams.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
            Monitor active incidents, asset health, site conditions, and audit-ready
            event context from one focused command surface.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-3">
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="text-lg font-semibold text-white">5</p>
            <p>Seeded assets</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="text-lg font-semibold text-white">1</p>
            <p>Active incident</p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <p className="text-lg font-semibold text-white">3</p>
            <p>Demo roles</p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-md border border-white/10 bg-ink-850 p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-signal-green/30 bg-signal-green/10 text-signal-green">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Secure Login</h2>
              <p className="text-sm text-slate-500">Seeded account access</p>
            </div>
          </div>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-signal-cyan"
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-11 w-full border border-white/10 bg-ink-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-signal-cyan"
                autoComplete="current-password"
              />
            </label>
          </div>

          {error ? (
            <div className="mt-4 border border-signal-red/30 bg-signal-red/10 px-3 py-2 text-sm text-signal-red">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 bg-signal-cyan px-4 text-sm font-semibold text-ink-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LockKeyhole className="h-4 w-4" />
            {isSubmitting ? "Authenticating" : "Enter Console"}
          </button>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword("sentinel123");
                }}
                className="border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs transition hover:border-signal-cyan/50 hover:text-white"
              >
                <span className="block font-semibold text-white">{account.label}</span>
                <span className="block truncate text-slate-500">{account.email}</span>
              </button>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
}
