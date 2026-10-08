export const ROLES = ["storekeeper", "procurement"] as const;
export type Role = (typeof ROLES)[number];

export const CATEGORIES = [
  "Tubular",
  "MRO",
  "Serialized Asset",
  "Consumable",
  "Chemical",
  "Wellhead",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LOCATIONS = [
  "Houston Supply Base",
  "Port Arthur Terminal",
  "Corpus Christi Terminal",
  "Galveston Terminal",
  "Midland Logistics Yard",
  "Gulf of Mexico Rig Alpha",
  "Gulf of Mexico Rig Bravo",
] as const;
export type Location = (typeof LOCATIONS)[number];

export const WELLS = [
  "GC-743 / A-14",
  "GC-743 / A-18",
  "MC-778 / B-07",
  "HI-376 / C-22",
  "WD-109 / D-03",
] as const;
export type Well = (typeof WELLS)[number];

export const UNITS = ["jt", "ea", "set", "reel", "MT"] as const;
export type Unit = (typeof UNITS)[number];

export const CERT_INTENTS = ["Valid", "Pending Review"] as const;
export type CertIntent = (typeof CERT_INTENTS)[number];

export type CertStatus = "Valid" | "Expiring" | "Expired" | "Pending Review";
export type Health = "Optimal" | "Low Stock" | "Critical";

export const ACTIONS = [
  "CHECK_IN",
  "CHECK_OUT",
  "TRANSFER",
  "ADJUST",
  "BIN_UPDATE",
  "CERT_UPDATE",
  "CREATE",
  "REORDER_REQUESTED",
  "REORDER_APPROVED",
  "REORDER_REJECTED",
] as const;
export type Action = (typeof ACTIONS)[number];

export const ADJUST_REASONS = [
  "Cycle count",
  "Damage / scrap",
  "Found stock",
  "Correction",
] as const;

export const MAKERS = [
  "Aker Solutions",
  "Baker Hughes",
  "Cameron",
  "Dril-Quip",
  "Expro",
  "Halliburton",
  "Hydril",
  "MI-SWACO",
  "MSA Safety",
  "NOV",
  "SLB",
  "TechnipFMC",
  "Tenaris",
  "Vallourec",
  "Weatherford",
] as const;

export interface Persona {
  name: string;
  title: string;
  base: string;
}

export const PERSONAS: Record<Role, Persona> = {
  storekeeper: {
    name: "John Smith",
    title: "Inventory Officer",
    base: "Houston Supply Base",
  },
  procurement: {
    name: "David Young",
    title: "Procurement Manager",
    base: "Houston Commercial",
  },
};

export interface Session {
  role: Role;
  name: string;
  title: string;
  base: string;
  signedInAt: string;
}

export interface Item {
  id: string;
  name: string;
  sku: string;
  serial: string;
  category: Category;
  location: Location;
  bin: string;
  quantity: number;
  unit: Unit;
  unitCost: number;
  reorderPoint: number;
  onOrder: number;
  certification: CertIntent;
  certBody: string;
  certExpiry: string;
  manufacturer: string;
  updatedAt: string;
}

export interface Movement {
  id: string;
  at: string;
  actor: string;
  role: Role;
  action: Action;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unit: string;
  location: string;
  destination: string;
  wellId: string;
  note: string;
  prevHash: string;
  hash: string;
  reference: string;
}

export type MovementDraft = Omit<Movement, "prevHash" | "hash" | "reference">;

export interface Transfer {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
  from: Location;
  to: Location;
  wellId: string;
  status: "In Transit" | "Received";
  departedAt: string;
  receivedAt?: string;
  reference: string;
  actor: string;
}

export interface Reorder {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitCost: number;
  vendor: string;
  status: "Pending" | "Approved" | "Rejected";
  requestedAt: string;
  requestedBy: string;
  decidedAt?: string;
  decidedBy?: string;
  note: string;
}

export interface AppData {
  items: Item[];
  movements: Movement[];
  transfers: Transfer[];
  reorders: Reorder[];
}

export type View = "dashboard" | "inventory" | "transfers" | "reorders" | "audit";

export function viewsFor(role: Role): { id: View; label: string }[] {
  const views: { id: View; label: string }[] = [
    { id: "dashboard", label: "Overview" },
    { id: "inventory", label: "Inventory" },
    { id: "transfers", label: "Transfers" },
    { id: "reorders", label: role === "procurement" ? "Approvals" : "Repurchase" },
  ];
  if (role === "procurement") views.push({ id: "audit", label: "Compliance" });
  return views;
}

export function access(role: Role) {
  const storekeeper = role === "storekeeper";
  const procurement = role === "procurement";
  return {
    mutateStock: storekeeper,
    requestReorder: storekeeper,
    viewMoney: procurement,
    approveReorder: procurement,
    viewAudit: procurement,
  };
}
