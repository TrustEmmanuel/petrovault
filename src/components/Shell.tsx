import { useEffect, useState } from "react";
import { formatDay } from "../lib/format";
import { useStore } from "../state/store";
import { viewsFor, type Role, type View } from "../types";
import { Audit } from "./Audit";
import { ConfirmDialog } from "./Dialogs";
import { Dashboard } from "./Dashboard";
import { Inventory } from "./Inventory";
import { Reorders } from "./Reorders";
import { Transfers } from "./Transfers";
import { cx, fieldClass } from "./ui";

function readView(role: Role): View {
  const hash = window.location.hash.replace("#", "") as View;
  return viewsFor(role).some((view) => view.id === hash) ? hash : "dashboard";
}

function pageCopy(view: View, role: Role) {
  if (view === "dashboard") {
    return { title: "Overview", lede: `${formatDay()} · United States stock points` };
  }
  if (view === "inventory") {
    return {
      title: "Inventory",
      lede:
        role === "storekeeper"
          ? "Receive, issue, edit bins, and request reorders."
          : "Read-only register with unit cost. Reorder decisions sit under Approvals.",
    };
  }
  if (view === "transfers") {
    return {
      title: "Transfers",
      lede:
        role === "storekeeper"
          ? "Confirm receipt when cargo arrives at the destination."
          : "Material in motion. Receipt confirmation sits with the Inventory Officer.",
    };
  }
  if (view === "reorders") {
    return {
      title: role === "procurement" ? "Reorder approvals" : "Repurchase",
      lede:
        role === "procurement"
          ? "Approve or reject low-stock requests before a purchase order is raised."
          : "Requests stay pending until Procurement decides.",
    };
  }
  return {
    title: "Compliance register",
    lede: "Append-only record of actor, quantity, and destination well. Each row commits to the previous hash.",
  };
}

export function Shell() {
  const { session, switchRole, signOut, resetDemo } = useStore();
  const [hashView, setHashView] = useState<View>(() => readView(session?.role ?? "storekeeper"));
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!session) return;
    function onHash() {
      if (!session) return;
      setHashView(readView(session.role));
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [session]);

  if (!session) return null;

  const nav = viewsFor(session.role);
  const view = nav.some((item) => item.id === hashView) ? hashView : "dashboard";
  const copy = pageCopy(view, session.role);

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-zinc-900 md:grid md:grid-cols-[216px_minmax(0,1fr)]">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-white focus:px-2 focus:py-1 focus:text-xs"
      >
        Skip to content
      </a>
      <aside className="border-b border-white/10 bg-[#101114] text-zinc-300 md:sticky md:top-0 md:h-screen md:overflow-y-auto md:border-b-0 md:border-r">
        <button
          type="button"
          onClick={() => {
            window.location.hash = "dashboard";
          }}
          className="flex h-12 w-full items-center gap-2 border-b border-white/10 px-3 text-left"
        >
          <span className="grid h-6 w-6 place-items-center border border-white/20 text-[10px] font-semibold tracking-wide text-white">
            PV
          </span>
          <span className="text-[11px] font-semibold tracking-[0.16em] text-white">PETROVAULT</span>
        </button>
        <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:py-3" aria-label="Primary">
          {nav.map((item) => {
            const active = item.id === view;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  window.location.hash = item.id;
                }}
                className={cx(
                  "flex h-8 shrink-0 items-center border-b-2 px-2.5 text-xs md:border-b-0 md:border-l-2",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  active
                    ? "border-amber-500 bg-white/10 text-white"
                    : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <p className="hidden px-3 pb-4 text-[11px] leading-4 text-zinc-500 md:block">United States · Demo workspace</p>
      </aside>

      <div className="min-w-0">
        <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 md:px-6">
          <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.14em] text-amber-900">
            DEMO
          </span>
          <span className="text-xs text-zinc-500">Upstream materials</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-[11px] uppercase tracking-[0.06em] text-zinc-500" htmlFor="view-as">
              View as
            </label>
            <select
              id="view-as"
              className={`${fieldClass} w-48`}
              value={session.role}
              onChange={(event) => {
                const role = event.target.value;
                if (role === "storekeeper" || role === "procurement") switchRole(role);
              }}
            >
              <option value="storekeeper">Inventory Officer</option>
              <option value="procurement">Procurement Manager</option>
            </select>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-zinc-950">{session.name}</p>
              <p className="text-[11px] text-zinc-500">{session.base}</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="h-8 border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Reset demo data
            </button>
            <button
              type="button"
              onClick={signOut}
              className="h-8 px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            >
              Sign out
            </button>
          </div>
        </header>

        <main id="content" className="px-4 py-4 md:px-6 md:py-5">
          <header className="mb-4">
            <h1 className="text-base font-semibold tracking-tight text-zinc-950">{copy.title}</h1>
            <p className="mt-0.5 text-xs text-zinc-500">{copy.lede}</p>
          </header>
          <div key={view} className="rise">
            {view === "dashboard" ? <Dashboard /> : null}
            {view === "inventory" ? <Inventory /> : null}
            {view === "transfers" ? <Transfers /> : null}
            {view === "reorders" ? <Reorders /> : null}
            {view === "audit" ? <Audit /> : null}
          </div>
        </main>
      </div>

      <HashGuard view={view} role={session.role} />
      {confirmReset ? (
        <ConfirmDialog
          title="Reset demo data"
          body="Restore the baseline inventory, open transfers, reorder queue, and compliance register. Your sign-in stays active."
          confirmLabel="Restore baseline"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            resetDemo();
            setConfirmReset(false);
          }}
        />
      ) : null}
    </div>
  );
}

function HashGuard({ view, role }: { view: View; role: Role }) {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const allowed = viewsFor(role).some((item) => item.id === hash);
    if (hash && !allowed && view === "dashboard") window.location.hash = "dashboard";
  }, [view, role]);
  return null;
}
