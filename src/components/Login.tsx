import { useState, type FormEvent } from "react";
import { offshoreActive } from "../lib/metrics";
import { useStore } from "../state/store";
import { PERSONAS, type Role } from "../types";
import { ConfirmDialog } from "./Dialogs";
import { Button, fieldClass } from "./ui";

const copy: Record<Role, string> = {
  storekeeper:
    "Receive, issue, update bins, and transfer stock to a rig or well. Valuations and the compliance register stay with Procurement.",
  procurement:
    "Review valuations, certification exposure, and the append-only register. Approve or reject reorders. Stock movements stay with the Inventory Officer.",
};

export function Login() {
  const { data, signIn, resetDemo } = useStore();
  const [role, setRole] = useState<Role>("storekeeper");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const persona = PERSONAS[role];
  const points = new Set(data.items.map((item) => item.location)).size;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.trim().length < 4) {
      setError("Enter at least 4 characters. This demo does not check a real password.");
      return;
    }
    signIn(role);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(400px,0.95fr)]">
      <section className="mesh relative hidden flex-col justify-between p-10 text-zinc-300 lg:flex">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-white">PETROVAULT</p>
          <h1 className="mt-10 max-w-md text-2xl font-semibold tracking-tight text-white">
            Materials control from the supply base to the wellhead.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-400">
            Custody of tubulars, MRO, chemicals, and serialized assets for U.S. Gulf and onshore operations.
          </p>
        </div>
        <dl className="grid max-w-md grid-cols-2 gap-px border border-white/10 bg-white/10 text-xs">
          <Fact label="Stocked lines" value={String(data.items.length)} />
          <Fact label="Stock points" value={String(points)} />
          <Fact label="Gulf in transit" value={String(offshoreActive(data).length)} />
          <Fact label="Register entries" value={String(data.movements.length)} />
        </dl>
      </section>

      <section className="flex flex-col bg-[#f3f4f6]">
        <div className="mesh px-5 py-4 lg:hidden">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-white">PETROVAULT</p>
          <p className="mt-1 text-xs text-zinc-400">Materials control</p>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <form noValidate onSubmit={onSubmit} autoComplete="off" className="w-full max-w-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">Sign in</p>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-zinc-950">Choose an operating role</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Navigation and actions follow the role. Use the list to switch during testing.
            </p>

            <label className="mt-6 block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              className={`${fieldClass} mt-1`}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              <option value="storekeeper">Inventory Officer — {PERSONAS.storekeeper.name}</option>
              <option value="procurement">Procurement Manager — {PERSONAS.procurement.name}</option>
            </select>

            <div className="mt-3 border border-zinc-200 bg-white px-3 py-2.5">
              <p className="text-xs font-medium text-zinc-950">{persona.name}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {persona.title} · {persona.base}
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-600">{copy[role]}</p>
            </div>

            <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={`${fieldClass} mt-1`}
              value={password}
              autoComplete="off"
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
            />
            {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
            <p className="mt-1 text-[11px] leading-4 text-zinc-500">
              Demo access. Any password of 4 or more characters is accepted and stays in this browser.
            </p>

            <Button type="submit" variant="primary" size="md" className="mt-5 w-full">
              Enter workspace
            </Button>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="mt-3 text-[11px] text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
            >
              Reset demo data
            </button>
          </form>
        </div>
      </section>

      {confirmReset ? (
        <ConfirmDialog
          title="Reset demo data"
          body="Restore the baseline inventory, open transfers, reorder queue, and compliance register in this browser."
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#101114] px-3 py-3">
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-white">{value}</dd>
    </div>
  );
}
