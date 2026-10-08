import { appendMovement } from "../lib/chain";
import { isOffshore } from "../lib/domain";
import type {
  CheckInInput,
  DecideInput,
  EditInput,
  IssueInput,
  NewItem,
  ReceiveInput,
  ReorderInput,
} from "../lib/schema";
import type { AppData, Item, MovementDraft, Reorder, Session, Transfer } from "../types";

export type MutationResult =
  | { ok: true; data: AppData; message: string }
  | { ok: false; message: string };

function ok(data: AppData, message: string): MutationResult {
  return { ok: true, data, message };
}

function fail(message: string): MutationResult {
  return { ok: false, message };
}

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function storekeeperOnly(session: Session) {
  return session.role === "storekeeper"
    ? null
    : "That action is limited to the Inventory Officer role.";
}

function baseDraft(
  session: Session,
  item: Item,
  action: MovementDraft["action"],
  quantity: number,
  location: string,
  destination: string,
  wellId: string,
  note: string,
): MovementDraft {
  return {
    id: uid("mv"),
    at: new Date().toISOString(),
    actor: session.name,
    role: session.role,
    action,
    itemId: item.id,
    itemName: item.name,
    sku: item.sku,
    quantity,
    unit: item.unit,
    location,
    destination,
    wellId,
    note,
  };
}

export function applyAdd(data: AppData, session: Session, input: NewItem): MutationResult {
  const denied = storekeeperOnly(session);
  if (denied) return fail(denied);
  const duplicate = data.items.some(
    (item) => item.sku === input.sku && item.location === input.location,
  );
  if (duplicate) {
    return fail("This SKU is already stocked at that location. Receive against the existing line.");
  }
  const at = new Date().toISOString();
  const item: Item = {
    id: uid("itm"),
    name: input.name,
    sku: input.sku,
    serial: input.serial,
    category: input.category,
    location: input.location,
    bin: input.bin,
    quantity: input.quantity,
    unit: input.unit,
    unitCost: input.unitCost,
    reorderPoint: input.reorderPoint,
    onOrder: 0,
    certification: input.certification,
    certBody: input.certBody,
    certExpiry: input.certExpiry,
    manufacturer: input.manufacturer,
    updatedAt: at,
  };
  const movements = appendMovement(data.movements, {
    ...baseDraft(session, item, "CREATE", item.quantity, item.location, "", "", `Opened at ${item.bin}.`),
    at,
    itemId: item.id,
  });
  const reference = movements.at(-1)?.reference ?? "";
  return ok(
    { ...data, items: [...data.items, item], movements },
    `Added ${item.name}. Register ${reference}.`,
  );
}

export function applyEdit(data: AppData, session: Session, itemId: string, input: EditInput): MutationResult {
  const denied = storekeeperOnly(session);
  if (denied) return fail(denied);
  const item = data.items.find((row) => row.id === itemId);
  if (!item) return fail("That line is no longer on the register.");
  const quantityChanged = input.quantity !== item.quantity;
  const binChanged = input.bin !== item.bin;
  const expiry = input.certification === "Pending Review" ? input.certExpiry : input.certExpiry;
  const certChanged = input.certification !== item.certification || expiry !== item.certExpiry;
  if (!quantityChanged && !binChanged && !certChanged) return fail("No changes to record.");

  const at = new Date().toISOString();
  let movements = data.movements;
  if (quantityChanged) {
    movements = appendMovement(
      movements,
      baseDraft(
        session,
        item,
        "ADJUST",
        input.quantity - item.quantity,
        item.location,
        "",
        "",
        `${input.reason}. On hand ${item.quantity} → ${input.quantity} ${item.unit}.`,
      ),
    );
  }
  if (binChanged) {
    movements = appendMovement(
      movements,
      baseDraft(
        session,
        item,
        "BIN_UPDATE",
        0,
        item.location,
        "",
        "",
        `Bin ${item.bin} → ${input.bin}.`,
      ),
    );
  }
  if (certChanged) {
    const expiryLabel = expiry ? expiry : "no expiry on file";
    movements = appendMovement(
      movements,
      baseDraft(
        session,
        item,
        "CERT_UPDATE",
        0,
        item.location,
        "",
        "",
        input.certification === "Pending Review"
          ? "Certification set to pending review."
          : `Certificate expiry set to ${expiryLabel}.`,
      ),
    );
  }
  const items = data.items.map((row) =>
    row.id === item.id
      ? {
          ...row,
          quantity: input.quantity,
          bin: input.bin,
          certification: input.certification,
          certExpiry: expiry,
          updatedAt: at,
        }
      : row,
  );
  const reference = movements.at(-1)?.reference ?? "";
  return ok({ ...data, items, movements }, `Stock record updated. Register ${reference}.`);
}

export function applyCheckIn(
  data: AppData,
  session: Session,
  itemId: string,
  input: CheckInInput,
): MutationResult {
  const denied = storekeeperOnly(session);
  if (denied) return fail(denied);
  const item = data.items.find((row) => row.id === itemId);
  if (!item) return fail("That line is no longer on the register.");
  const at = new Date().toISOString();
  const covered = Math.min(item.onOrder, input.quantity);
  const orderNote = covered > 0 ? ` ${covered} ${item.unit} applied to the open order.` : "";
  const movements = appendMovement(
    data.movements,
    baseDraft(
      session,
      item,
      "CHECK_IN",
      input.quantity,
      item.location,
      "",
      "",
      `${input.note} Bin ${input.bin}.${orderNote}`,
    ),
  );
  const items = data.items.map((row) =>
    row.id === item.id
      ? {
          ...row,
          quantity: row.quantity + input.quantity,
          bin: input.bin,
          onOrder: row.onOrder - covered,
          updatedAt: at,
        }
      : row,
  );
  const reference = movements.at(-1)?.reference ?? "";
  return ok(
    { ...data, items, movements },
    `Received ${input.quantity} ${item.unit}. Register ${reference}.`,
  );
}

export function applyIssue(
  data: AppData,
  session: Session,
  itemId: string,
  input: IssueInput,
): MutationResult {
  const denied = storekeeperOnly(session);
  if (denied) return fail(denied);
  const item = data.items.find((row) => row.id === itemId);
  if (!item) return fail("That line is no longer on the register.");
  if (input.destination === item.location) return fail("Choose a different location.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > item.quantity) {
    return fail(`Quantity must be a whole number no greater than ${item.quantity} ${item.unit}.`);
  }
  if (isOffshore(input.destination) && !input.wellId) {
    return fail("A well ID is required for an offshore issue.");
  }
  const at = new Date().toISOString();
  const note = input.note || `Issued to ${input.destination}.`;
  const movements = appendMovement(data.movements, {
    ...baseDraft(session, item, "TRANSFER", input.quantity, item.location, input.destination, input.wellId, note),
    at,
  });
  const sealed = movements.at(-1);
  if (!sealed) return fail("The register did not accept this movement.");
  const transfer: Transfer = {
    id: uid("tr"),
    itemId: item.id,
    itemName: item.name,
    sku: item.sku,
    quantity: input.quantity,
    unit: item.unit,
    unitCost: item.unitCost,
    from: item.location,
    to: input.destination,
    wellId: input.wellId,
    status: "In Transit",
    departedAt: at,
    reference: sealed.reference,
    actor: session.name,
  };
  const items = data.items.map((row) =>
    row.id === item.id ? { ...row, quantity: row.quantity - input.quantity, updatedAt: at } : row,
  );
  return ok(
    { ...data, items, movements, transfers: [...data.transfers, transfer] },
    `Issued ${input.quantity} ${item.unit} to ${input.destination}. Register ${sealed.reference}.`,
  );
}

export function applyReceiveTransfer(
  data: AppData,
  session: Session,
  transferId: string,
  input: ReceiveInput,
): MutationResult {
  const denied = storekeeperOnly(session);
  if (denied) return fail(denied);
  const transfer = data.transfers.find((row) => row.id === transferId);
  if (!transfer || transfer.status !== "In Transit") {
    return fail("That transfer is not open.");
  }
  const at = new Date().toISOString();
  const items = data.items.map((row) => ({ ...row }));
  const source = items.find((row) => row.id === transfer.itemId);
  if (!source) return fail("The source line is no longer on the register.");
  const moveSerial = source.quantity === 0 && source.serial !== "";
  let destination = items.find(
    (row) => row.sku === source.sku && row.location === transfer.to && row.id !== source.id,
  );
  if (!destination) {
    destination = {
      ...source,
      id: uid("itm"),
      location: transfer.to,
      bin: input.bin,
      quantity: transfer.quantity,
      onOrder: 0,
      serial: moveSerial ? source.serial : "",
      updatedAt: at,
    };
    items.push(destination);
    if (moveSerial) source.serial = "";
  } else {
    destination.quantity += transfer.quantity;
    destination.bin = input.bin;
    destination.updatedAt = at;
    if (moveSerial && !destination.serial) {
      destination.serial = source.serial;
      source.serial = "";
    }
  }
  source.updatedAt = at;
  const note = input.note
    ? `${input.note} Received from ${transfer.from}. Transfer ${transfer.reference}.`
    : `Received from ${transfer.from}. Transfer ${transfer.reference}. Bin ${input.bin}.`;
  const movements = appendMovement(data.movements, {
    ...baseDraft(session, destination, "CHECK_IN", transfer.quantity, transfer.to, "", transfer.wellId, note),
    at,
    itemId: destination.id,
    itemName: destination.name,
    sku: destination.sku,
  });
  const reference = movements.at(-1)?.reference ?? "";
  const transfers = data.transfers.map((row) =>
    row.id === transfer.id ? { ...row, status: "Received" as const, receivedAt: at } : row,
  );
  return ok(
    { ...data, items, movements, transfers },
    `Received ${transfer.quantity} ${transfer.unit} at ${transfer.to}. Register ${reference}.`,
  );
}

export function applyRequestReorder(
  data: AppData,
  session: Session,
  itemId: string,
  input: ReorderInput,
): MutationResult {
  const denied = storekeeperOnly(session);
  if (denied) return fail(denied);
  const item = data.items.find((row) => row.id === itemId);
  if (!item) return fail("That line is no longer on the register.");
  const pending = data.reorders.some((row) => row.itemId === item.id && row.status === "Pending");
  if (pending) return fail("A reorder for this line is already waiting on Procurement.");
  const at = new Date().toISOString();
  const note = input.note || `Reorder requested from ${input.vendor}.`;
  const reorder: Reorder = {
    id: uid("rq"),
    itemId: item.id,
    itemName: item.name,
    sku: item.sku,
    quantity: input.quantity,
    unit: item.unit,
    unitCost: item.unitCost,
    vendor: input.vendor,
    status: "Pending",
    requestedAt: at,
    requestedBy: session.name,
    note,
  };
  const movements = appendMovement(
    data.movements,
    baseDraft(session, item, "REORDER_REQUESTED", input.quantity, item.location, "", "", note),
  );
  const reference = movements.at(-1)?.reference ?? "";
  return ok(
    { ...data, reorders: [...data.reorders, reorder], movements },
    `Reorder sent to Procurement. Register ${reference}.`,
  );
}

export function applyDecide(
  data: AppData,
  session: Session,
  reorderId: string,
  decision: "Approved" | "Rejected",
  input: DecideInput,
): MutationResult {
  if (session.role !== "procurement") {
    return fail("Reorder decisions are limited to Procurement.");
  }
  const reorder = data.reorders.find((row) => row.id === reorderId);
  if (!reorder) return fail("That request is no longer in the queue.");
  if (reorder.status !== "Pending") return fail("This request is already decided.");
  const item = data.items.find((row) => row.id === reorder.itemId);
  if (!item) return fail("The stock line for this request is missing.");
  const at = new Date().toISOString();
  const note =
    input.note ||
    (decision === "Approved"
      ? `Approved ${reorder.quantity} ${reorder.unit} from ${reorder.vendor}.`
      : `Rejected reorder from ${reorder.vendor}.`);
  const movements = appendMovement(
    data.movements,
    baseDraft(
      session,
      item,
      decision === "Approved" ? "REORDER_APPROVED" : "REORDER_REJECTED",
      reorder.quantity,
      item.location,
      "",
      "",
      note,
    ),
  );
  const items =
    decision === "Approved"
      ? data.items.map((row) =>
          row.id === item.id ? { ...row, onOrder: row.onOrder + reorder.quantity, updatedAt: at } : row,
        )
      : data.items;
  const reorders = data.reorders.map((row) =>
    row.id === reorder.id
      ? { ...row, status: decision, decidedAt: at, decidedBy: session.name, note }
      : row,
  );
  const reference = movements.at(-1)?.reference ?? "";
  const verb = decision === "Approved" ? "Approved" : "Rejected";
  return ok({ ...data, items, reorders, movements }, `${verb} ${reorder.sku}. Register ${reference}.`);
}
