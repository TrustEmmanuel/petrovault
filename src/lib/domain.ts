import { addDaysKey, todayKey } from "./format";
import type { CertStatus, Health, Item, Transfer } from "../types";

export function isOffshore(location: string) {
  return location.startsWith("Gulf of Mexico");
}

export function healthOf(item: Item): Health {
  if (item.quantity <= 0) return "Critical";
  if (item.reorderPoint <= 0) return "Optimal";
  if (item.quantity <= item.reorderPoint * 0.5) return "Critical";
  if (item.quantity <= item.reorderPoint) return "Low Stock";
  return "Optimal";
}

export function certOf(item: Item, today = todayKey()): CertStatus {
  if (item.certification === "Pending Review" || !item.certExpiry) return "Pending Review";
  if (item.certExpiry < today) return "Expired";
  if (item.certExpiry <= addDaysKey(today, 45)) return "Expiring";
  return "Valid";
}

export function transitQtyFor(itemId: string, transfers: Transfer[]) {
  return transfers
    .filter((transfer) => transfer.itemId === itemId && transfer.status === "In Transit")
    .reduce((sum, transfer) => sum + transfer.quantity, 0);
}

export function lineValue(item: Item) {
  return item.quantity * item.unitCost;
}
