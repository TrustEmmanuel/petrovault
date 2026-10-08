import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AddItemDialog,
  CheckInDialog,
  EditDialog,
  IssueDialog,
  ReorderDialog,
} from "./Dialogs";
import { assignedWell, passportEntries } from "../lib/board";
import { certOf, healthOf, transitQtyFor } from "../lib/domain";
import { clearInventoryFocus, peekInventoryFocus, subscribeInventoryFocus } from "../lib/focus";
import { ACTION_LABEL, formatExpiry, formatMovementQty, formatWhen, money, shortLocation } from "../lib/format";
import { useStore } from "../state/store";
import {
  CATEGORIES,
  LOCATIONS,
  access,
  type CertStatus,
  type Health,
  type Item,
} from "../types";
import { Badge, Button, cx, fieldClass } from "./ui";

type StockFilter = "all" | Health | "In Transit";
type SortKey = "name" | "sku" | "category" | "location" | "quantity" | "unitCost" | "certification" | "status";
type DialogState =
  | { kind: "add" }
  | { kind: "edit"; id: string }
  | { kind: "receive"; id: string }
  | { kind: "issue"; id: string }
  | { kind: "reorder"; id: string }
  | null;

export function Inventory() {
  const { data, session } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [cert, setCert] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const pending = new Set(data.reorders.filter((row) => row.status === "Pending").map((row) => row.itemId));

  useEffect(() => {
    function applyFocus() {
      const next = peekInventoryFocus();
      if (!next) return;
      if (next.location) {
        setLocation(next.location);
        setQuery("");
        setCategory("all");
        setStock("all");
        setCert("all");
      }
      if (next.itemId) setSelectedId(next.itemId);
    }
    applyFocus();
    const timer = window.setTimeout(clearInventoryFocus, 0);
    const unsubscribe = subscribeInventoryFocus(() => {
      applyFocus();
      clearInventoryFocus();
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = data.items.filter((item) => {
      const health = healthOf(item);
      const status = certOf(item);
      const transit = transitQtyFor(item.id, data.transfers) > 0;
      const haystack = [item.name, item.sku, item.serial, item.manufacturer, item.location, item.bin]
        .join(" ")
        .toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (category !== "all" && item.category !== category) return false;
      if (location !== "all" && item.location !== location) return false;
      if (stock === "In Transit" && !transit) return false;
      if (stock !== "all" && stock !== "In Transit" && health !== stock) return false;
      if (cert !== "all" && status !== cert) return false;
      return true;
    });
    const direction = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [category, cert, data.items, data.transfers, location, query, sort.dir, sort.key, stock]);

  if (!session) return null;
  const can = access(session.role);
  const selected = data.items.find((item) => item.id === selectedId) ?? null;
  const active = dialog?.kind === "add" ? null : data.items.find((item) => item.id === dialog?.id) ?? null;

  function toggle(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setLocation("all");
    setStock("all");
    setCert("all");
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={`${fieldClass} w-full sm:w-64`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, SKU, serial, bin"
          aria-label="Search inventory"
        />
        <Filter value={category} onChange={setCategory} label="Category">
          <option value="all">All categories</option>
          {CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Filter>
        <Filter value={location} onChange={setLocation} label="Location">
          <option value="all">All locations</option>
          {LOCATIONS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Filter>
        <Filter value={stock} onChange={(value) => setStock(value as StockFilter)} label="Stock state">
          <option value="all">All stock states</option>
          <option>Optimal</option>
          <option>Low Stock</option>
          <option>Critical</option>
          <option>In Transit</option>
        </Filter>
        <Filter value={cert} onChange={setCert} label="Certification">
          <option value="all">All certifications</option>
          <option>Valid</option>
          <option>Expiring</option>
          <option>Expired</option>
          <option>Pending Review</option>
        </Filter>
        {can.mutateStock ? (
          <Button variant="primary" size="md" className="sm:ml-auto" onClick={() => setDialog({ kind: "add" })}>
            Add item
          </Button>
        ) : null}
      </div>

      <div className="max-h-[calc(100vh-13.5rem)] overflow-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-50 text-[11px] uppercase tracking-[0.06em] text-zinc-500 shadow-[inset_0_-1px_0_#e4e4e7]">
            <tr>
              <SortHead label="Item" sortKey="name" sort={sort} onSort={toggle} />
              <SortHead label="SKU / serial" sortKey="sku" sort={sort} onSort={toggle} />
              <SortHead label="Category" sortKey="category" sort={sort} onSort={toggle} />
              <SortHead label="Location" sortKey="location" sort={sort} onSort={toggle} />
              <SortHead label="On hand" sortKey="quantity" sort={sort} onSort={toggle} align="right" />
              {can.viewMoney ? <SortHead label="Unit cost" sortKey="unitCost" sort={sort} onSort={toggle} align="right" /> : null}
              <SortHead label="Certification" sortKey="certification" sort={sort} onSort={toggle} />
              <SortHead label="Status" sortKey="status" sort={sort} onSort={toggle} />
              <th className="px-2 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const health = healthOf(item);
              const status = certOf(item);
              const transit = transitQtyFor(item.id, data.transfers);
              return (
                <tr
                  key={item.id}
                  tabIndex={0}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("button")) return;
                    setSelectedId(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setSelectedId(item.id);
                  }}
                  className={cx(
                    "cursor-pointer border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50",
                    selectedId === item.id && "bg-zinc-50",
                  )}
                >
                  <td className="max-w-[240px] px-2 py-2">
                    <p className="truncate font-medium text-zinc-950" title={item.name}>{item.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">{item.manufacturer}</p>
                  </td>
                  <td className="px-2 py-2">
                    <p className="text-zinc-900">{item.sku}</p>
                    <p className="text-[11px] text-zinc-500">{item.serial || "—"}</p>
                    {item.serial ? <p className="text-[11px] text-zinc-400">Passport</p> : null}
                  </td>
                  <td className="px-2 py-2 text-zinc-700">{item.category}</td>
                  <td className="px-2 py-2">
                    <p className="text-zinc-900" title={item.location}>{shortLocation(item.location)}</p>
                    <p className="text-[11px] text-zinc-500">Bin {item.bin}</p>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <p>{item.quantity.toLocaleString("en-US")} {item.unit}</p>
                    {transit > 0 ? <p className="text-[11px] text-sky-700">{transit.toLocaleString("en-US")} in transit</p> : null}
                    {item.onOrder > 0 ? <p className="text-[11px] text-zinc-500">{item.onOrder.toLocaleString("en-US")} on order</p> : null}
                  </td>
                  {can.viewMoney ? (
                    <td className="px-2 py-2 text-right tabular-nums text-zinc-900">{money(item.unitCost)}</td>
                  ) : null}
                  <td className="px-2 py-2">
                    <Badge tone={certTone(status)}>{status}</Badge>
                    <p className="mt-1 text-[11px] text-zinc-500">{item.certBody || "—"} · {formatExpiry(item.certExpiry)}</p>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={healthTone(health)}>{health}</Badge>
                      {transit > 0 ? <Badge tone="info">In Transit</Badge> : null}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1 whitespace-nowrap">
                      {can.mutateStock ? (
                        <>
                          <Button onClick={() => setDialog({ kind: "receive", id: item.id })}>Receive</Button>
                          <Button disabled={item.quantity <= 0} onClick={() => setDialog({ kind: "issue", id: item.id })}>Issue</Button>
                          <Button onClick={() => setDialog({ kind: "edit", id: item.id })}>Edit</Button>
                          <Button disabled={pending.has(item.id)} onClick={() => setDialog({ kind: "reorder", id: item.id })}>
                            {pending.has(item.id) ? "Queued" : "Reorder"}
                          </Button>
                        </>
                      ) : (
                        <span className="text-[11px] text-zinc-500">{pending.has(item.id) ? "Awaiting approval" : "View only"}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-zinc-500">
            No lines match these filters.
            <button type="button" className="ml-2 font-medium text-zinc-900" onClick={clearFilters}>
              Clear filters
            </button>
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Showing {rows.length} of {data.items.length} lines
      </p>

      {selected ? (
        <ItemDrawer
          item={selected}
          pending={pending.has(selected.id)}
          canMutate={can.mutateStock}
          onClose={() => setSelectedId(null)}
          onEdit={() => setDialog({ kind: "edit", id: selected.id })}
          onIssue={() => setDialog({ kind: "issue", id: selected.id })}
          onReceive={() => setDialog({ kind: "receive", id: selected.id })}
          onReorder={() => setDialog({ kind: "reorder", id: selected.id })}
        />
      ) : null}

      {dialog?.kind === "add" ? <AddItemDialog onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "edit" && active ? <EditDialog key={active.id} item={active} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "receive" && active ? <CheckInDialog key={active.id} item={active} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "issue" && active ? <IssueDialog key={active.id} item={active} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "reorder" && active ? <ReorderDialog key={active.id} item={active} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function ItemDrawer({
  item,
  pending,
  canMutate,
  onClose,
  onEdit,
  onIssue,
  onReceive,
  onReorder,
}: {
  item: Item;
  pending: boolean;
  canMutate: boolean;
  onClose: () => void;
  onEdit: () => void;
  onIssue: () => void;
  onReceive: () => void;
  onReorder: () => void;
}) {
  const { data } = useStore();
  const health = healthOf(item);
  const status = certOf(item);
  const transit = data.transfers.filter((row) => row.itemId === item.id && row.status === "In Transit");
  const history = data.movements.filter((row) => row.sku === item.sku).slice(-8).reverse();

  return (
    <div className="fade fixed inset-0 z-30 flex justify-end bg-zinc-950/30">
      <button type="button" className="flex-1 cursor-default" aria-label="Close details" onClick={onClose} />
      <aside className="panel h-full w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-white" role="dialog" aria-label={item.name}>
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">{item.sku}</p>
            <h2 className="mt-1 text-sm font-semibold tracking-tight text-zinc-950">{item.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-900">
            Close
          </button>
        </div>
        <div className="flex flex-wrap gap-1 px-4 py-3">
          <Badge tone={healthTone(health)}>{health}</Badge>
          <Badge tone={certTone(status)}>{status}</Badge>
          {transit.length > 0 ? <Badge tone="info">In Transit</Badge> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 px-4 pb-4 text-xs">
          <Detail label="Serial" value={item.serial || "—"} />
          <Detail label="Category" value={item.category} />
          <Detail label="Location" value={item.location} />
          <Detail label="Bin" value={item.bin} />
          <Detail label="On hand" value={`${item.quantity.toLocaleString("en-US")} ${item.unit}`} />
          <Detail label="Reorder point" value={`${item.reorderPoint.toLocaleString("en-US")} ${item.unit}`} />
          <Detail label="On order" value={`${item.onOrder.toLocaleString("en-US")} ${item.unit}`} />
          <Detail label="Manufacturer" value={item.manufacturer} />
          <Detail label="Standard" value={item.certBody || "—"} />
          <Detail label="Expiry" value={formatExpiry(item.certExpiry)} />
        </dl>
        {transit.length > 0 ? (
          <div className="mx-4 mb-3 border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            {transit.map((row) => (
              <p key={row.id}>
                {row.quantity} {row.unit} in transit to {row.to}
                {row.wellId ? ` · ${row.wellId}` : ""} · {row.reference}
              </p>
            ))}
          </div>
        ) : null}
        {pending ? (
          <p className="mx-4 mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            A reorder is waiting on Procurement.
          </p>
        ) : null}
        {canMutate ? (
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            <Button onClick={onReceive}>Receive</Button>
            <Button disabled={item.quantity <= 0} onClick={onIssue}>Issue</Button>
            <Button onClick={onEdit}>Edit</Button>
            <Button disabled={pending} onClick={onReorder}>{pending ? "Queued" : "Reorder"}</Button>
          </div>
        ) : null}
        {item.serial || item.category === "Serialized Asset" ? (
          <Passport item={item} />
        ) : (
          <div className="border-t border-zinc-200 px-4 py-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">SKU history</h3>
            <ul className="mt-2">
              {history.map((movement) => (
                <li key={movement.id} className="border-t border-zinc-100 py-2">
                  <p className="text-xs text-zinc-900">
                    {ACTION_LABEL[movement.action]} · {formatMovementQty(movement.action, movement.quantity, movement.unit)}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {formatWhen(movement.at)} · {movement.actor} · {movement.reference}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function Passport({ item }: { item: Item }) {
  const { data } = useStore();
  const entries = passportEntries(item, data.movements);
  const well = assignedWell(item, data);
  const transit = data.transfers.find((row) => row.sku === item.sku && row.status === "In Transit");

  return (
    <div className="border-t border-zinc-200 px-4 py-3">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">Custody passport</h3>
      <p className="mt-2 text-xs text-zinc-800">
        Now at {item.location}, bin {item.bin}.
        {well ? ` Assigned well ${well}.` : ""}
        {transit ? ` ${transit.quantity} ${transit.unit} in transit to ${transit.to}.` : ""}
      </p>
      {entries.length === 0 ? (
        <p className="mt-2 text-[11px] text-zinc-500">No earlier movement is filed for this serial. Current custody is the start of the passport.</p>
      ) : null}
      <ol className="mt-2">
        {entries.map((movement, index) => (
          <li key={movement.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 border-t border-zinc-100 py-2">
            <span className="pt-0.5 text-[11px] tabular-nums text-zinc-400">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-xs text-zinc-900">
                {ACTION_LABEL[movement.action]}
                {movement.destination ? ` · ${shortLocation(movement.location)} → ${shortLocation(movement.destination)}` : ` · ${shortLocation(movement.location)}`}
                {movement.wellId ? ` · ${movement.wellId}` : ""}
              </p>
              <p className="text-[11px] text-zinc-500">
                {formatWhen(movement.at)} · {movement.actor} · {formatMovementQty(movement.action, movement.quantity, movement.unit)} · {movement.hash}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-900">{value}</dd>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select className={`${fieldClass} w-auto`} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {children}
    </select>
  );
}

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cx("px-2 py-2 font-medium", align === "right" && "text-right")} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cx("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}
      >
        {label}
        <span className="text-[9px] text-zinc-400">{active ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

function sortValue(item: Item, key: SortKey) {
  if (key === "quantity") return item.quantity;
  if (key === "unitCost") return item.unitCost;
  if (key === "certification") return certOf(item);
  if (key === "status") return healthOf(item);
  return item[key];
}

function healthTone(health: Health) {
  if (health === "Optimal") return "good" as const;
  if (health === "Low Stock") return "warn" as const;
  return "bad" as const;
}

function certTone(status: CertStatus) {
  if (status === "Valid") return "good" as const;
  if (status === "Expiring") return "warn" as const;
  if (status === "Expired") return "bad" as const;
  return "neutral" as const;
}
