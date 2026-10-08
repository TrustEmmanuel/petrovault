import { certOf, healthOf, isOffshore, lineValue } from "./domain";
import { addDaysKey, dayLabel, todayKey } from "./format";
import type { AppData, Item, Movement } from "../types";

export const PRIOR = {
  label: "30 Sep",
  valuation: 2_040_000,
  skus: 19,
  alerts: 12,
  offshoreTransfers: 2,
};

export function totalValuation(data: AppData) {
  const onHand = data.items.reduce((sum, item) => sum + lineValue(item), 0);
  const transit = data.transfers
    .filter((transfer) => transfer.status === "In Transit")
    .reduce((sum, transfer) => sum + transfer.quantity * transfer.unitCost, 0);
  return onHand + transit;
}

export function alertItems(items: Item[]) {
  return items.filter((item) => healthOf(item) !== "Optimal");
}

export function offshoreActive(data: AppData) {
  return data.transfers.filter(
    (transfer) => transfer.status === "In Transit" && isOffshore(transfer.to),
  );
}

export function velocity(movements: Movement[], days = 14) {
  const today = todayKey();
  const latest = movements.reduce((max, movement) => {
    const key = todayKey(new Date(movement.at));
    return key > max ? key : max;
  }, today);
  const end = latest > today ? latest : today;
  const keys = Array.from({ length: days }, (_, index) => addDaysKey(end, index - (days - 1)));
  const rows = keys.map((key) => ({ key, label: dayLabel(key), inbound: 0, outbound: 0 }));
  const index = new Map(rows.map((row, position) => [row.key, position]));
  for (const movement of movements) {
    const key = todayKey(new Date(movement.at));
    const position = index.get(key);
    if (position === undefined) continue;
    if (movement.action === "CHECK_IN") rows[position].inbound += 1;
    if (movement.action === "CHECK_OUT" || movement.action === "TRANSFER") {
      rows[position].outbound += 1;
    }
  }
  return rows;
}

export function certCounts(items: Item[]) {
  return items.reduce(
    (counts, item) => {
      const status = certOf(item);
      if (status === "Expiring") counts.expiring += 1;
      if (status === "Expired") counts.expired += 1;
      if (status === "Pending Review") counts.pending += 1;
      return counts;
    },
    { expiring: 0, expired: 0, pending: 0 },
  );
}

export type TrendDir = "up" | "down" | "flat";

export function trend(current: number, prior: number, mode: "percent" | "delta") {
  const delta = current - prior;
  const dir: TrendDir = delta > 0.05 || (mode === "delta" && delta > 0) ? "up" : delta < -0.05 || (mode === "delta" && delta < 0) ? "down" : "flat";
  if (dir === "flat") return { dir, text: `No change vs ${PRIOR.label}` };
  if (mode === "delta") {
    const sign = delta > 0 ? "+" : "−";
    return { dir, text: `${sign}${Math.abs(delta)} vs ${PRIOR.label}` };
  }
  const pct = (delta / prior) * 100;
  const sign = pct > 0 ? "+" : "−";
  return { dir, text: `${sign}${Math.abs(pct).toFixed(1)}% vs ${PRIOR.label}` };
}

export function trendClass(dir: TrendDir, intent: "up-good" | "up-bad") {
  if (dir === "flat") return "text-zinc-500";
  const favorable = (dir === "up" && intent === "up-good") || (dir === "down" && intent === "up-bad");
  return favorable ? "text-emerald-700" : "text-red-700";
}
