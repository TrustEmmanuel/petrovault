import { useState } from "react";
import { DecideDialog } from "./Dialogs";
import { formatWhen, money } from "../lib/format";
import { useStore } from "../state/store";
import { access, type Reorder } from "../types";
import { Badge, Button } from "./ui";

const rank = { Pending: 0, Approved: 1, Rejected: 2 };

export function Reorders() {
  const { data, session } = useStore();
  const [decision, setDecision] = useState<{ reorder: Reorder; choice: "Approved" | "Rejected" } | null>(null);
  if (!session) return null;
  const can = access(session.role);
  const rows = data.reorders.slice().sort((a, b) => rank[a.status] - rank[b.status] || b.requestedAt.localeCompare(a.requestedAt));

  return (
    <div>
      <div className="overflow-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.06em] text-zinc-500">
            <tr>
              {["Item", "Qty", "Vendor", "Requested", "Status", "Note"].map((label) => (
                <th key={label} className="border-b border-zinc-200 px-2 py-2 text-left font-medium">{label}</th>
              ))}
              {can.viewMoney ? <th className="border-b border-zinc-200 px-2 py-2 text-right font-medium">Estimate</th> : null}
              <th className="border-b border-zinc-200 px-2 py-2 text-right font-medium">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((reorder) => (
              <tr key={reorder.id} className="border-b border-zinc-100 align-top">
                <td className="px-2 py-2">
                  <p className="font-medium text-zinc-950">{reorder.itemName}</p>
                  <p className="text-[11px] text-zinc-500">{reorder.sku}</p>
                </td>
                <td className="px-2 py-2 tabular-nums">{reorder.quantity.toLocaleString("en-US")} {reorder.unit}</td>
                <td className="px-2 py-2">{reorder.vendor}</td>
                <td className="px-2 py-2 text-zinc-600">
                  <p>{formatWhen(reorder.requestedAt)}</p>
                  <p className="text-[11px] text-zinc-500">{reorder.requestedBy}</p>
                  {reorder.decidedAt ? (
                    <p className="text-[11px] text-zinc-500">
                      {reorder.status} {formatWhen(reorder.decidedAt)} · {reorder.decidedBy}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <Badge tone={reorder.status === "Approved" ? "good" : reorder.status === "Rejected" ? "bad" : "warn"}>
                    {reorder.status}
                  </Badge>
                </td>
                <td className="max-w-xs px-2 py-2 text-zinc-600">{reorder.note}</td>
                {can.viewMoney ? (
                  <td className="px-2 py-2 text-right tabular-nums">{money(reorder.quantity * reorder.unitCost)}</td>
                ) : null}
                <td className="px-2 py-2">
                  <div className="flex justify-end gap-1">
                    {can.approveReorder && reorder.status === "Pending" ? (
                      <>
                        <Button variant="primary" onClick={() => setDecision({ reorder, choice: "Approved" })}>Approve</Button>
                        <Button onClick={() => setDecision({ reorder, choice: "Rejected" })}>Reject</Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-zinc-400">{reorder.status === "Pending" ? "With Procurement" : "Closed"}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-3 py-8 text-center text-xs text-zinc-500">No reorder requests.</p> : null}
      </div>
      {decision ? (
        <DecideDialog reorder={decision.reorder} decision={decision.choice} onClose={() => setDecision(null)} />
      ) : null}
    </div>
  );
}
