import { certOf, healthOf, isOffshore, lineValue } from "./domain";
import { transitAgeDays } from "./format";
import type { AppData, Item, Location, Movement, Transfer } from "../types";

export const RIGS = ["Gulf of Mexico Rig Alpha", "Gulf of Mexico Rig Bravo"] as const;

export const LOCATION_GROUPS: { id: string; label: string; locations: Location[] }[] = [
  { id: "houston", label: "Houston", locations: ["Houston Supply Base"] },
  {
    id: "terminals",
    label: "Terminals",
    locations: ["Port Arthur Terminal", "Corpus Christi Terminal", "Galveston Terminal"],
  },
  { id: "midland", label: "Midland", locations: ["Midland Logistics Yard"] },
  { id: "alpha", label: "GoM Alpha", locations: ["Gulf of Mexico Rig Alpha"] },
  { id: "bravo", label: "GoM Bravo", locations: ["Gulf of Mexico Rig Bravo"] },
];

export function rigSnapshot(data: AppData, rig: Location) {
  const onRig = data.items
    .filter((item) => item.location === rig && item.quantity > 0)
    .sort((a, b) => b.quantity * b.unitCost - a.quantity * a.unitCost);
  const inbound = data.transfers
    .filter((transfer) => transfer.status === "In Transit" && transfer.to === rig)
    .sort((a, b) => a.departedAt.localeCompare(b.departedAt));
  const wells = new Set<string>();
  for (const transfer of data.transfers) {
    if (transfer.to === rig && transfer.wellId) wells.add(transfer.wellId);
  }
  for (const movement of data.movements) {
    if (movement.wellId && (movement.destination === rig || movement.location === rig)) wells.add(movement.wellId);
  }
  return { onRig, inbound, wells: [...wells] };
}

export function locationMeasures(data: AppData, money: boolean) {
  return LOCATION_GROUPS.map((group) => {
    const onHand = data.items.filter((item) => group.locations.includes(item.location));
    const inbound = data.transfers.filter(
      (transfer) => transfer.status === "In Transit" && group.locations.includes(transfer.to),
    );
    const value = money
      ? onHand.reduce((sum, item) => sum + lineValue(item), 0) +
        inbound.reduce((sum, transfer) => sum + transfer.quantity * transfer.unitCost, 0)
      : onHand.reduce((sum, item) => sum + item.quantity, 0) +
        inbound.reduce((sum, transfer) => sum + transfer.quantity, 0);
    return { ...group, value, lines: onHand.length, shipments: inbound.length };
  });
}

export type ShiftTask =
  | { id: string; tone: "info" | "warn" | "bad"; kicker: string; title: string; detail: string; transferId: string; kind: "receive" | "aged" }
  | { id: string; tone: "warn" | "bad"; kicker: string; title: string; detail: string; itemId: string; kind: "issue" | "cert" | "expired" }
  | { id: string; tone: "warn"; kicker: string; title: string; detail: string; reorderId: string; kind: "reorder" };

export function officerQueue(data: AppData): ShiftTask[] {
  const receipts: ShiftTask[] = data.transfers
    .filter((transfer) => transfer.status === "In Transit")
    .sort((a, b) => a.departedAt.localeCompare(b.departedAt))
    .slice(0, 3)
    .map((transfer) => ({
      id: `rx-${transfer.id}`,
      tone: "info",
      kicker: "Receipt due",
      title: transfer.itemName,
      detail: `${transfer.quantity} ${transfer.unit} into ${transfer.to}${transfer.wellId ? ` · ${transfer.wellId}` : ""}`,
      transferId: transfer.id,
      kind: "receive",
    }));
  const issues: ShiftTask[] = data.items
    .filter((item) => item.quantity > 0 && !isOffshore(item.location) && healthOf(item) !== "Optimal")
    .sort((a, b) => rankHealth(a) - rankHealth(b) || a.quantity - b.quantity)
    .slice(0, 3)
    .map((item) => ({
      id: `is-${item.id}`,
      tone: healthOf(item) === "Critical" ? "bad" : "warn",
      kicker: "Issue waiting",
      title: item.name,
      detail: `${item.quantity} ${item.unit} at ${item.location} · ${healthOf(item)}`,
      itemId: item.id,
      kind: "issue",
    }));
  const certs: ShiftTask[] = data.items
    .filter((item) => certOf(item) === "Expiring")
    .slice(0, 3)
    .map((item) => ({
      id: `ce-${item.id}`,
      tone: "warn",
      kicker: "Certificate",
      title: item.name,
      detail: `${item.certBody || "Certificate"} · ${item.location}`,
      itemId: item.id,
      kind: "cert",
    }));
  return [...receipts, ...issues, ...certs];
}

export function procurementQueue(data: AppData): ShiftTask[] {
  const reorders: ShiftTask[] = data.reorders
    .filter((reorder) => reorder.status === "Pending")
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
    .slice(0, 4)
    .map((reorder) => ({
      id: `ro-${reorder.id}`,
      tone: "warn",
      kicker: "Repurchase",
      title: reorder.itemName,
      detail: `${reorder.quantity} ${reorder.unit} · ${reorder.vendor}`,
      reorderId: reorder.id,
      kind: "reorder",
    }));
  const expired: ShiftTask[] = data.items
    .filter((item) => certOf(item) === "Expired")
    .slice(0, 3)
    .map((item) => ({
      id: `ex-${item.id}`,
      tone: "bad",
      kicker: "Expired certificate",
      title: item.name,
      detail: `${item.certBody || "Certificate"} · ${item.location}`,
      itemId: item.id,
      kind: "expired",
    }));
  const aged: ShiftTask[] = data.transfers
    .filter((transfer) => transfer.status === "In Transit" && transitAgeDays(transfer.departedAt) >= 10)
    .sort((a, b) => a.departedAt.localeCompare(b.departedAt))
    .slice(0, 3)
    .map((transfer) => ({
      id: `ag-${transfer.id}`,
      tone: "bad",
      kicker: `${transitAgeDays(transfer.departedAt)}d in transit`,
      title: transfer.itemName,
      detail: `${transfer.from} → ${transfer.to}${transfer.wellId ? ` · ${transfer.wellId}` : ""}`,
      transferId: transfer.id,
      kind: "aged",
    }));
  return [...reorders, ...expired, ...aged];
}

export function ticketFromTransfer(transfer: Transfer, movements: Movement[]) {
  const movement = movements.find((row) => row.reference === transfer.reference);
  return {
    reference: transfer.reference,
    sku: transfer.sku,
    itemName: transfer.itemName,
    quantity: transfer.quantity,
    unit: transfer.unit,
    from: transfer.from,
    to: transfer.to,
    wellId: transfer.wellId,
    actor: transfer.actor,
    hash: movement?.hash ?? "",
  };
}

export function passportEntries(item: Item, movements: Movement[]) {
  return movements
    .filter((movement) => movement.sku === item.sku || movement.itemId === item.id)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function assignedWell(item: Item, data: AppData) {
  const open = data.transfers.find(
    (transfer) => transfer.status === "In Transit" && transfer.sku === item.sku && transfer.to === item.location && transfer.wellId,
  );
  if (open?.wellId) return open.wellId;
  const inbound = data.transfers.find(
    (transfer) => transfer.status === "In Transit" && (transfer.itemId === item.id || transfer.sku === item.sku) && transfer.wellId,
  );
  if (item.quantity === 0 && inbound?.wellId) return inbound.wellId;
  const history = passportEntries(item, data.movements);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const movement = history[index];
    if (!movement.wellId) continue;
    const arrivedHere = movement.destination === item.location || (movement.location === item.location && !movement.destination);
    if (arrivedHere) return movement.wellId;
  }
  return "";
}

function rankHealth(item: Item) {
  const health = healthOf(item);
  if (health === "Critical") return 0;
  if (health === "Low Stock") return 1;
  return 2;
}
