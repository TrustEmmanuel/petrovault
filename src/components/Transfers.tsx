import { useState } from "react";
import { ReceiveTransferDialog } from "./Dialogs";
import { formatWhen, money, shortLocation, transitAgeDays } from "../lib/format";
import { useStore } from "../state/store";
import { access, type Transfer } from "../types";
import { Badge, Button, fieldClass } from "./ui";

export function Transfers() {
  const { data, session } = useStore();
  const [filter, setFilter] = useState<"In Transit" | "Received" | "all">("In Transit");
  const [receipt, setReceipt] = useState<Transfer | null>(null);
  if (!session) return null;
  const can = access(session.role);
  const rows = data.transfers
    .filter((transfer) => (filter === "all" ? true : transfer.status === filter))
    .slice()
    .sort((a, b) => b.departedAt.localeCompare(a.departedAt));

  return (
    <div>
      <div className="mb-3">
        <select
          className={`${fieldClass} w-auto`}
          aria-label="Transfer status"
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
        >
          <option value="In Transit">In transit</option>
          <option value="Received">Received</option>
          <option value="all">All transfers</option>
        </select>
      </div>
      <div className="overflow-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[920px] border-collapse text-left text-xs">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.06em] text-zinc-500">
            <tr>
              {["Reference", "Item", "Qty", "From", "To", "Well", "Departed", "Status", "Action"].map((label) => (
                <th key={label} className="border-b border-zinc-200 px-2 py-2 text-left font-medium">{label}</th>
              ))}
              {can.viewMoney ? <th className="border-b border-zinc-200 px-2 py-2 text-right font-medium">Value</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((transfer) => {
              const age = transitAgeDays(transfer.departedAt);
              return (
                <tr key={transfer.id} className="border-b border-zinc-100 align-top">
                  <td className="px-2 py-2 font-mono text-[11px] text-zinc-600">{transfer.reference}</td>
                  <td className="px-2 py-2">
                    <p className="font-medium text-zinc-950">{transfer.itemName}</p>
                    <p className="text-[11px] text-zinc-500">{transfer.sku}</p>
                  </td>
                  <td className="px-2 py-2 tabular-nums">{transfer.quantity.toLocaleString("en-US")} {transfer.unit}</td>
                  <td className="px-2 py-2" title={transfer.from}>{shortLocation(transfer.from)}</td>
                  <td className="px-2 py-2" title={transfer.to}>{shortLocation(transfer.to)}</td>
                  <td className="px-2 py-2 text-zinc-700">{transfer.wellId || "—"}</td>
                  <td className="px-2 py-2 text-zinc-600">{formatWhen(transfer.departedAt)}</td>
                  <td className="px-2 py-2">
                    {transfer.status === "In Transit" ? <Badge tone="info">In Transit</Badge> : <Badge tone="good">Received</Badge>}
                    {transfer.status === "In Transit" ? (
                      <p className={age >= 10 ? "mt-1 text-[11px] text-amber-800" : "mt-1 text-[11px] text-zinc-500"}>{age}d open</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    {can.mutateStock && transfer.status === "In Transit" ? (
                      <Button onClick={() => setReceipt(transfer)}>Receive</Button>
                    ) : (
                      <span className="text-[11px] text-zinc-400">{transfer.status === "Received" ? "Closed" : "—"}</span>
                    )}
                  </td>
                  {can.viewMoney ? (
                    <td className="px-2 py-2 text-right tabular-nums">{money(transfer.quantity * transfer.unitCost)}</td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-3 py-8 text-center text-xs text-zinc-500">No transfers in this view.</p> : null}
      </div>
      {receipt ? <ReceiveTransferDialog transfer={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}
