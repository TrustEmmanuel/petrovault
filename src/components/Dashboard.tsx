import { useState } from "react";
import {
  RIGS,
  locationMeasures,
  officerQueue,
  procurementQueue,
  rigSnapshot,
  ticketFromTransfer,
  type ShiftTask,
} from "../lib/board";
import { certOf, healthOf, lineValue } from "../lib/domain";
import { openInventory } from "../lib/focus";
import { ACTION_LABEL, formatMovementQty, formatWhen, money, moneyCompact, shortLocation } from "../lib/format";
import {
  PRIOR,
  alertItems,
  certCounts,
  offshoreActive,
  totalValuation,
  trend,
  trendClass,
  velocity,
} from "../lib/metrics";
import { useStore } from "../state/store";
import { access, type Location } from "../types";
import { DecideDialog, EditDialog, IssueDialog, ReceiveTransferDialog } from "./Dialogs";
import { DeliveryTicket } from "./Ticket";
import { Badge, cx } from "./ui";

export function Dashboard() {
  const { data, session } = useStore();
  const [task, setTask] = useState<ShiftTask | null>(null);
  if (!session) return null;
  const can = access(session.role);
  const valuation = totalValuation(data);
  const alerts = alertItems(data.items);
  const offshore = offshoreActive(data);
  const certs = certCounts(data.items);
  const critical = data.items.filter((item) => healthOf(item) === "Critical").length;
  const low = data.items.filter((item) => healthOf(item) === "Low Stock").length;
  const onOrder = data.items.filter((item) => item.onOrder > 0).length;
  const bars = velocity(data.movements);
  const maxBar = Math.max(1, ...bars.flatMap((row) => [row.inbound, row.outbound]));
  const inbound = bars.reduce((sum, row) => sum + row.inbound, 0);
  const outbound = bars.reduce((sum, row) => sum + row.outbound, 0);
  const valuable = [...data.items].sort((a, b) => lineValue(b) - lineValue(a)).slice(0, 5);
  const recent = data.movements.slice(-6).reverse();
  const valueTrend = trend(valuation, PRIOR.valuation, "percent");
  const skuTrend = trend(data.items.length, PRIOR.skus, "delta");
  const alertTrend = trend(alerts.length, PRIOR.alerts, "delta");
  const transferTrend = trend(offshore.length, PRIOR.offshoreTransfers, "delta");
  const queue = can.mutateStock ? officerQueue(data) : procurementQueue(data);
  const barsByLocation = locationMeasures(data, can.viewMoney);
  const maxLocation = Math.max(1, ...barsByLocation.map((row) => row.value));
  const taskItem = task && "itemId" in task ? data.items.find((item) => item.id === task.itemId) ?? null : null;
  const taskTransfer = task && "transferId" in task ? data.transfers.find((row) => row.id === task.transferId) ?? null : null;
  const taskReorder = task && "reorderId" in task ? data.reorders.find((row) => row.id === task.reorderId) ?? null : null;

  function openTask(next: ShiftTask) {
    if (next.kind === "expired") {
      openInventory({ itemId: next.itemId });
      return;
    }
    setTask(next);
  }

  return (
    <div>
      <ShiftQueue tasks={queue} onOpen={openTask} />

      <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Inventory valuation"
          accent="border-l-zinc-900"
          value={can.viewMoney ? moneyCompact(valuation) : "Restricted"}
          detail={can.viewMoney ? money(valuation) : "Visible to Procurement"}
          muted={!can.viewMoney}
          trend={can.viewMoney ? valueTrend.text : "Visible to Procurement"}
          trendClassName={can.viewMoney ? trendClass(valueTrend.dir, "up-good") : "text-zinc-500"}
        />
        <Kpi
          label="Total SKUs"
          accent="border-l-zinc-500"
          value={String(data.items.length)}
          trend={skuTrend.text}
          trendClassName={trendClass(skuTrend.dir, "up-good")}
        />
        <Kpi
          label="Low stock / reorder"
          accent="border-l-amber-600"
          value={String(alerts.length)}
          trend={alertTrend.text}
          trendClassName={trendClass(alertTrend.dir, "up-bad")}
        />
        <Kpi
          label="Gulf transfers"
          accent="border-l-sky-700"
          value={String(offshore.length)}
          trend={transferTrend.text}
          trendClassName={trendClass(transferTrend.dir, "up-bad")}
        />
      </section>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
        <span><span className="font-medium text-red-700">{critical}</span> critical</span>
        <span><span className="font-medium text-amber-800">{low}</span> low stock</span>
        <span><span className="font-medium text-amber-800">{certs.expiring}</span> certs expiring</span>
        <span><span className="font-medium text-red-700">{certs.expired}</span> expired</span>
        <span><span className="font-medium text-zinc-800">{certs.pending}</span> pending review</span>
        <span><span className="font-medium text-sky-800">{offshore.length}</span> Gulf in transit</span>
        {onOrder > 0 ? <span><span className="font-medium text-zinc-800">{onOrder}</span> on order</span> : null}
      </p>

      <LocationBars rows={barsByLocation} max={maxLocation} money={can.viewMoney} />

      <section className="mt-3 grid gap-3 md:grid-cols-2">
        {RIGS.map((rig) => (
          <RigCard key={rig} rig={rig} />
        ))}
      </section>

      <section className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.8fr)]">
        <article className="border border-zinc-200 bg-white">
          <header className="flex items-baseline justify-between gap-3 border-b border-zinc-200 px-3 py-2.5">
            <h2 className="text-xs font-semibold text-zinc-950">Stock velocity</h2>
            <p className="text-[11px] text-zinc-500">
              {inbound} receipts · {outbound} issues
            </p>
          </header>
          <div className="px-3 py-3">
            <div className="flex h-24 items-end gap-1" role="img" aria-label="Receipts and issues over the last 14 days">
              {bars.map((row) => (
                <div key={row.key} className="flex h-full flex-1 items-end justify-center gap-0.5" title={`${row.label}: ${row.inbound} in, ${row.outbound} out`}>
                  <div className="w-1.5 bg-emerald-700" style={{ height: barHeight(row.inbound, maxBar) }} />
                  <div className="w-1.5 bg-zinc-800" style={{ height: barHeight(row.outbound, maxBar) }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
              <span>{bars[0]?.label}</span>
              <span>{bars.at(-1)?.label}</span>
            </div>
            <p className="mt-2 flex gap-4 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 bg-emerald-700" /> Receipts</span>
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 bg-zinc-800" /> Issues</span>
            </p>
          </div>
          <div className="border-t border-zinc-200">
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">Recent movements</h3>
              {can.viewAudit ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-800"
                  onClick={() => {
                    window.location.hash = "audit";
                  }}
                >
                  Open register
                </button>
              ) : null}
            </div>
            <ul>
              {recent.map((movement) => (
                <li key={movement.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] gap-3 border-t border-zinc-100 px-3 py-2">
                  <p className="text-[11px] text-zinc-500">{formatWhen(movement.at)}</p>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-zinc-900">
                      {ACTION_LABEL[movement.action]} · {movement.itemName}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">{movement.note}</p>
                  </div>
                  <p className="text-xs tabular-nums text-zinc-800">
                    {formatMovementQty(movement.action, movement.quantity, movement.unit)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="border border-zinc-200 bg-white">
          <header className="border-b border-zinc-200 px-3 py-2.5">
            <h2 className="text-xs font-semibold text-zinc-950">High-value asset status</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {can.viewMoney ? "Ranked by on-hand value." : "Ranked for custody. Values are hidden."}
            </p>
          </header>
          <ul>
            {valuable.map((item) => {
              const health = healthOf(item);
              return (
                <li key={item.id} className="flex items-start justify-between gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-950">{item.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">{item.location}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs tabular-nums text-zinc-900">
                      {can.viewMoney ? money(lineValue(item)) : `${item.quantity} ${item.unit}`}
                    </p>
                    <div className="mt-1 flex justify-end gap-1">
                      <Badge tone={health === "Optimal" ? "good" : health === "Low Stock" ? "warn" : "bad"}>{health}</Badge>
                      <Badge tone={certOf(item) === "Valid" ? "good" : certOf(item) === "Expired" ? "bad" : certOf(item) === "Expiring" ? "warn" : "neutral"}>
                        {certOf(item)}
                      </Badge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      {task?.kind === "receive" && taskTransfer ? (
        <ReceiveTransferDialog transfer={taskTransfer} onClose={() => setTask(null)} />
      ) : null}
      {task?.kind === "issue" && taskItem ? <IssueDialog item={taskItem} onClose={() => setTask(null)} /> : null}
      {task?.kind === "cert" && taskItem ? <EditDialog item={taskItem} onClose={() => setTask(null)} /> : null}
      {task?.kind === "reorder" && taskReorder ? (
        <DecideDialog reorder={taskReorder} decision="Approved" onClose={() => setTask(null)} />
      ) : null}
      {task?.kind === "aged" && taskTransfer ? (
        <DeliveryTicket ticket={ticketFromTransfer(taskTransfer, data.movements)} onClose={() => setTask(null)} />
      ) : null}
    </div>
  );
}

function ShiftQueue({ tasks, onOpen }: { tasks: ShiftTask[]; onOpen: (task: ShiftTask) => void }) {
  return (
    <section className="border border-zinc-200 bg-white">
      <header className="flex items-baseline justify-between gap-3 border-b border-zinc-200 px-3 py-2">
        <h2 className="text-xs font-semibold text-zinc-950">Shift queue</h2>
        <p className="text-[11px] text-zinc-500">{tasks.length === 0 ? "Clear" : `${tasks.length} open`}</p>
      </header>
      {tasks.length === 0 ? (
        <p className="px-3 py-3 text-xs text-zinc-500">Nothing is waiting on this role.</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id} className="border-t border-zinc-100 first:border-t-0">
              <button
                type="button"
                onClick={() => onOpen(task)}
                className="grid w-full grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-3 px-3 py-2 text-left hover:bg-zinc-50"
              >
                <span
                  className={cx(
                    "text-[11px] font-medium",
                    task.tone === "bad" ? "text-red-700" : task.tone === "warn" ? "text-amber-800" : "text-sky-800",
                  )}
                >
                  {task.kicker}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-zinc-950">{task.title}</span>
                  <span className="block truncate text-[11px] text-zinc-500">{task.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LocationBars({
  rows,
  max,
  money: showMoney,
}: {
  rows: { id: string; label: string; value: number; lines: number; shipments: number }[];
  max: number;
  money: boolean;
}) {
  return (
    <section className="mt-3 border border-zinc-200 bg-white px-3 py-3">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold text-zinc-950">{showMoney ? "Value by location" : "Quantity by location"}</h2>
        <p className="text-[11px] text-zinc-500">
          {showMoney ? "On hand plus inbound." : "Units on hand plus inbound. Units are not converted."}
        </p>
      </header>
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li key={row.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3">
            <span className="text-[11px] text-zinc-600">{row.label}</span>
            <span className="h-1.5 bg-zinc-100">
              <span
                className="block h-1.5 bg-zinc-800"
                style={{ width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / max) * 100)}%` }}
              />
            </span>
            <span className="text-right text-[11px] tabular-nums text-zinc-800">
              {showMoney ? moneyCompact(row.value) : row.value.toLocaleString("en-US")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RigCard({ rig }: { rig: Location }) {
  const { data } = useStore();
  const snapshot = rigSnapshot(data, rig);
  return (
    <button
      type="button"
      onClick={() => openInventory({ location: rig })}
      className="border border-zinc-200 bg-white px-3 py-3 text-left hover:border-zinc-400"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold text-zinc-950">{shortLocation(rig)}</h2>
        <span className="text-[11px] text-zinc-500">
          {snapshot.onRig.length} on rig · {snapshot.inbound.length} inbound
        </span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        {snapshot.wells.length > 0 ? snapshot.wells.join(" · ") : "No well assigned"}
      </p>
      <ul className="mt-2 space-y-1">
        {snapshot.onRig.slice(0, 3).map((item) => (
          <li key={item.id} className="flex justify-between gap-3 text-xs text-zinc-800">
            <span className="truncate">{item.name}</span>
            <span className="shrink-0 tabular-nums text-zinc-500">{item.quantity} {item.unit}</span>
          </li>
        ))}
        {snapshot.inbound.slice(0, 2).map((transfer) => (
          <li key={transfer.id} className="flex justify-between gap-3 text-xs text-sky-800">
            <span className="truncate">{transfer.itemName}</span>
            <span className="shrink-0 tabular-nums">{transfer.quantity} {transfer.unit} inbound</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function Kpi({
  label,
  value,
  detail,
  trend: trendText,
  trendClassName,
  accent,
  muted = false,
}: {
  label: string;
  value: string;
  detail?: string;
  trend: string;
  trendClassName: string;
  accent: string;
  muted?: boolean;
}) {
  return (
    <article className={cx("border-y border-r border-zinc-200 bg-white px-3.5 py-3 border-l-2", accent)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <p
        className={cx("mt-2 font-semibold tracking-tight tabular-nums", muted ? "text-sm text-zinc-400" : "text-xl text-zinc-950")}
        title={detail}
      >
        {value}
      </p>
      <p className={cx("mt-1 text-[11px]", trendClassName)}>{trendText}</p>
    </article>
  );
}

function barHeight(value: number, max: number) {
  if (value <= 0) return "1px";
  return `${Math.max(14, (value / max) * 100)}%`;
}
