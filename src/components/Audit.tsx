import { useMemo, useState } from "react";
import { verifyChain } from "../lib/chain";
import { ACTION_LABEL, formatMovementQty, formatWhen, roleLabel, shortLocation } from "../lib/format";
import { useStore } from "../state/store";
import { ACTIONS, access } from "../types";
import { Button, fieldClass } from "./ui";

export function Audit() {
  const { data, session } = useStore();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [verdict, setVerdict] = useState("");
  const chain = useMemo(() => verifyChain(data.movements), [data.movements]);

  if (!session || !access(session.role).viewAudit) {
    return <p className="text-xs text-zinc-500">The compliance register is visible to Procurement.</p>;
  }

  const needle = query.trim().toLowerCase();
  const rows = data.movements.filter((movement) => {
    if (action !== "all" && movement.action !== action) return false;
    if (!needle) return true;
    return [movement.itemName, movement.sku, movement.actor, movement.note, movement.reference, movement.wellId, movement.hash]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const visible = newestFirst ? rows.slice().reverse() : rows;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={`${fieldClass} w-full sm:w-64`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search item, actor, well, hash"
          aria-label="Search register"
        />
        <select className={`${fieldClass} w-auto`} aria-label="Action" value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="all">All actions</option>
          {ACTIONS.map((item) => (
            <option key={item} value={item}>{ACTION_LABEL[item]}</option>
          ))}
        </select>
        <Button onClick={() => setNewestFirst((current) => !current)}>
          {newestFirst ? "Newest first" : "Oldest first"}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            const result = verifyChain(data.movements);
            setVerdict(
              result.ok
                ? `Chain intact · ${result.count} records · tip ${result.tip}`
                : `Chain broken at ${result.reference}`,
            );
          }}
        >
          Verify chain
        </Button>
      </div>
      <p className={verdict ? (chain.ok && !verdict.startsWith("Chain broken") ? "mb-3 text-xs text-emerald-700" : "mb-3 text-xs text-red-700") : "mb-3 text-xs text-zinc-500"}>
        {verdict || `Root 00000000 · ${data.movements.length} records · tip ${chain.ok ? chain.tip : "unverified"}`}
      </p>
      <div className="max-h-[calc(100vh-16rem)] overflow-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-zinc-50 text-[11px] uppercase tracking-[0.06em] text-zinc-500 shadow-[inset_0_-1px_0_#e4e4e7]">
            <tr>
              {["When", "Reference", "Actor", "Action", "Path", "Qty", "Well", "Hash"].map((label) => (
                <th key={label} className="px-2 py-2 text-left font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((movement) => (
              <tr key={movement.id} className="border-b border-zinc-100 align-top">
                <td className="whitespace-nowrap px-2 py-2 text-zinc-600">{formatWhen(movement.at)}</td>
                <td className="px-2 py-2 font-mono text-[11px] text-zinc-700">{movement.reference}</td>
                <td className="px-2 py-2">
                  <p className="text-zinc-900">{movement.actor}</p>
                  <p className="text-[11px] text-zinc-500">{roleLabel(movement.role)}</p>
                </td>
                <td className="max-w-xs px-2 py-2">
                  <p className="text-zinc-900">{ACTION_LABEL[movement.action]}</p>
                  <p className="truncate text-[11px] text-zinc-500" title={movement.note}>{movement.note}</p>
                </td>
                <td className="px-2 py-2 text-zinc-700" title={`${movement.location} ${movement.destination}`}>
                  {movement.destination
                    ? `${shortLocation(movement.location)} → ${shortLocation(movement.destination)}`
                    : shortLocation(movement.location)}
                  <p className="text-[11px] text-zinc-500">{movement.sku}</p>
                </td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                  {formatMovementQty(movement.action, movement.quantity, movement.unit)}
                </td>
                <td className="px-2 py-2 text-zinc-700">{movement.wellId || "—"}</td>
                <td className="px-2 py-2 font-mono text-[11px] text-zinc-600" title={`Previous ${movement.prevHash}`}>
                  {movement.hash}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? <p className="px-3 py-8 text-center text-xs text-zinc-500">No register rows match.</p> : null}
      </div>
    </div>
  );
}
