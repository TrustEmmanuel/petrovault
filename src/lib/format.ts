import type { Action, Role } from "../types";

const CENTRAL = "America/Chicago";

export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTRAL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CENTRAL,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CENTRAL,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);
}

export function formatExpiry(value: string) {
  if (!value) return "No expiry on file";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function money(value: number) {
  const digits = Number.isInteger(value) || Math.abs(value) >= 1000 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function moneyCompact(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return money(value);
}

export function shortLocation(location: string) {
  if (location === "Houston Supply Base") return "Houston";
  if (location === "Midland Logistics Yard") return "Midland Yard";
  if (location === "Gulf of Mexico Rig Alpha") return "GoM Alpha";
  if (location === "Gulf of Mexico Rig Bravo") return "GoM Bravo";
  return location.replace(" Terminal", "");
}

export function roleLabel(role: Role) {
  return role === "storekeeper" ? "Inventory Officer" : "Procurement Manager";
}

export const ACTION_LABEL: Record<Action, string> = {
  CHECK_IN: "Check in",
  CHECK_OUT: "Check out",
  TRANSFER: "Transfer",
  ADJUST: "Adjustment",
  BIN_UPDATE: "Bin update",
  CERT_UPDATE: "Certification",
  CREATE: "Item created",
  REORDER_REQUESTED: "Reorder requested",
  REORDER_APPROVED: "Reorder approved",
  REORDER_REJECTED: "Reorder rejected",
};

export function formatMovementQty(action: Action, quantity: number, unit: string) {
  if (action === "BIN_UPDATE" || action === "CERT_UPDATE") return "—";
  const sign = action === "ADJUST" && quantity > 0 ? "+" : "";
  return `${sign}${quantity.toLocaleString("en-US")} ${unit}`;
}

export function transitAgeDays(iso: string, now = new Date()) {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return Math.max(0, days);
}

export function dayLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
