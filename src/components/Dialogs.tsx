import { useRef, useState, type FormEvent } from "react";
import {
  addItemSchema,
  checkInSchema,
  decideSchema,
  editSchema,
  fieldErrors,
  issueSchema,
  receiveTransferSchema,
  reorderRequestSchema,
} from "../lib/schema";
import { useStore } from "../state/store";
import {
  ADJUST_REASONS,
  CATEGORIES,
  LOCATIONS,
  MAKERS,
  UNITS,
  WELLS,
  type Item,
  type Reorder,
  type Transfer,
} from "../types";
import { DeliveryTicket, type TicketModel } from "./Ticket";
import { Button, Field, Modal, areaClass, fieldClass } from "./ui";

type TicketRoute = { from: string; to: string; wellId: string };

function TicketAfter({ route, onClose }: { route: TicketRoute; onClose: () => void }) {
  const { data } = useStore();
  const movement = data.movements.at(-1);
  if (!movement) return null;
  const ticket: TicketModel = {
    reference: movement.reference,
    sku: movement.sku,
    itemName: movement.itemName,
    quantity: movement.quantity,
    unit: movement.unit,
    from: route.from || movement.location,
    to: route.to || movement.destination || movement.location,
    wellId: route.wellId || movement.wellId,
    actor: movement.actor,
    hash: movement.hash,
  };
  return <DeliveryTicket ticket={ticket} onClose={onClose} />;
}

function useGuard() {
  const busy = useRef(false);
  return {
    claim() {
      if (busy.current) return false;
      busy.current = true;
      return true;
    },
    release() {
      busy.current = false;
    },
  };
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="px-4 py-3 text-xs leading-5 text-zinc-600">{body}</p>
      <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

function Actions({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" size="md">
        {label}
      </Button>
    </div>
  );
}

export function AddItemDialog({ onClose }: { onClose: () => void }) {
  const { addItem } = useStore();
  const guard = useGuard();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    sku: "",
    serial: "",
    category: "Consumable" as (typeof CATEGORIES)[number],
    manufacturer: "",
    unit: "ea" as (typeof UNITS)[number],
    location: "Houston Supply Base" as (typeof LOCATIONS)[number],
    bin: "",
    quantity: "",
    unitCost: "",
    reorderPoint: "",
    certification: "Valid" as "Valid" | "Pending Review",
    certBody: "",
    certExpiry: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!guard.claim()) return;
    const parsed = addItemSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      guard.release();
      return;
    }
    if (!addItem(parsed.data)) guard.release();
    else onClose();
  }

  return (
    <Modal title="Add item" lede="Opens a stock line and writes a register entry." onClose={onClose} wide>
      <form noValidate onSubmit={onSubmit}>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <Field label="Item name" error={errors.name} className="sm:col-span-2">
            <input className={fieldClass} value={form.name} onChange={(event) => update("name", event.target.value)} />
          </Field>
          <Field label="SKU" error={errors.sku}>
            <input className={fieldClass} value={form.sku} onChange={(event) => update("sku", event.target.value)} />
          </Field>
          <Field label="Serial" error={errors.serial}>
            <input className={fieldClass} value={form.serial} onChange={(event) => update("serial", event.target.value)} />
          </Field>
          <Field label="Category" error={errors.category}>
            <select className={fieldClass} value={form.category} onChange={(event) => update("category", event.target.value as typeof form.category)}>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit" error={errors.unit}>
            <select className={fieldClass} value={form.unit} onChange={(event) => update("unit", event.target.value as typeof form.unit)}>
              {UNITS.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </Field>
          <Field label="Manufacturer" error={errors.manufacturer} className="sm:col-span-2">
            <input className={fieldClass} list="petrovault-makers" value={form.manufacturer} onChange={(event) => update("manufacturer", event.target.value)} />
            <datalist id="petrovault-makers">
              {MAKERS.map((maker) => (
                <option key={maker} value={maker} />
              ))}
            </datalist>
          </Field>
          <Field label="Location" error={errors.location}>
            <select className={fieldClass} value={form.location} onChange={(event) => update("location", event.target.value as typeof form.location)}>
              {LOCATIONS.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </Field>
          <Field label="Bin" error={errors.bin}>
            <input className={fieldClass} value={form.bin} onChange={(event) => update("bin", event.target.value)} />
          </Field>
          <Field label="Quantity" error={errors.quantity}>
            <input className={fieldClass} inputMode="numeric" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
          </Field>
          <Field label="Unit cost (USD)" error={errors.unitCost}>
            <input className={fieldClass} inputMode="decimal" value={form.unitCost} onChange={(event) => update("unitCost", event.target.value)} />
          </Field>
          <Field label="Reorder point" error={errors.reorderPoint}>
            <input className={fieldClass} inputMode="numeric" value={form.reorderPoint} onChange={(event) => update("reorderPoint", event.target.value)} />
          </Field>
          <Field label="Certification" error={errors.certification}>
            <select className={fieldClass} value={form.certification} onChange={(event) => update("certification", event.target.value as typeof form.certification)}>
              <option value="Valid">Follow expiry date</option>
              <option value="Pending Review">Pending review</option>
            </select>
          </Field>
          <Field label="Certifying standard" error={errors.certBody}>
            <input className={fieldClass} value={form.certBody} onChange={(event) => update("certBody", event.target.value)} placeholder="API 5CT" />
          </Field>
          <Field label="Certificate expiry" error={errors.certExpiry}>
            <input className={fieldClass} type="date" value={form.certExpiry} onChange={(event) => update("certExpiry", event.target.value)} />
          </Field>
        </div>
        <Actions onClose={onClose} label="Add item" />
      </form>
    </Modal>
  );
}

export function EditDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { editItem } = useStore();
  const guard = useGuard();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    quantity: String(item.quantity),
    bin: item.bin,
    reason: "",
    certification: item.certification,
    certExpiry: item.certExpiry,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!guard.claim()) return;
    const parsed = editSchema(item.quantity).safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      guard.release();
      return;
    }
    if (!editItem(item.id, parsed.data)) guard.release();
    else onClose();
  }

  return (
    <Modal title="Edit stock" lede={`${item.name} · ${item.sku}`} onClose={onClose}>
      <form noValidate onSubmit={onSubmit}>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <Field label="On hand" error={errors.quantity}>
            <input className={fieldClass} inputMode="numeric" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
          </Field>
          <Field label="Bin" error={errors.bin}>
            <input className={fieldClass} value={form.bin} onChange={(event) => update("bin", event.target.value)} />
          </Field>
          <Field label="Quantity reason" error={errors.reason} className="sm:col-span-2">
            <select className={fieldClass} value={form.reason} onChange={(event) => update("reason", event.target.value)}>
              <option value="">No quantity change</option>
              {ADJUST_REASONS.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </Field>
          <Field label="Certification" error={errors.certification}>
            <select className={fieldClass} value={form.certification} onChange={(event) => update("certification", event.target.value as typeof form.certification)}>
              <option value="Valid">Follow expiry date</option>
              <option value="Pending Review">Pending review</option>
            </select>
          </Field>
          <Field label="Certificate expiry" error={errors.certExpiry}>
            <input className={fieldClass} type="date" value={form.certExpiry} onChange={(event) => update("certExpiry", event.target.value)} />
          </Field>
        </div>
        <Actions onClose={onClose} label="Save" />
      </form>
    </Modal>
  );
}

export function CheckInDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { checkIn } = useStore();
  const guard = useGuard();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ quantity: "", bin: item.bin, note: "" });
  const [ticketRoute, setTicketRoute] = useState<TicketRoute | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!guard.claim()) return;
    const parsed = checkInSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      guard.release();
      return;
    }
    if (!checkIn(item.id, parsed.data)) guard.release();
    else setTicketRoute({ from: "", to: item.location, wellId: "" });
  }

  if (ticketRoute) return <TicketAfter route={ticketRoute} onClose={onClose} />;

  return (
    <Modal title="Receive stock" lede={`${item.name} · ${item.location}`} onClose={onClose}>
      <form noValidate onSubmit={onSubmit}>
        <div className="grid gap-3 px-4 py-3">
          <Field label="Quantity" error={errors.quantity}>
            <input className={fieldClass} inputMode="numeric" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </Field>
          <Field label="Bin" error={errors.bin}>
            <input className={fieldClass} value={form.bin} onChange={(event) => setForm({ ...form, bin: event.target.value })} />
          </Field>
          <Field label="Goods receipt" error={errors.note}>
            <textarea className={areaClass} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="GRN-45012" />
          </Field>
        </div>
        <Actions onClose={onClose} label="Receive" />
      </form>
    </Modal>
  );
}

export function IssueDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { issue } = useStore();
  const guard = useGuard();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    quantity: "",
    destination: LOCATIONS.find((location) => location !== item.location) ?? item.location,
    wellId: "",
    note: "",
  });
  const [ticketRoute, setTicketRoute] = useState<TicketRoute | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!guard.claim()) return;
    const parsed = issueSchema(item.quantity, item.location).safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      guard.release();
      return;
    }
    if (!issue(item.id, parsed.data)) guard.release();
    else setTicketRoute({ from: item.location, to: parsed.data.destination, wellId: parsed.data.wellId });
  }

  if (ticketRoute) return <TicketAfter route={ticketRoute} onClose={onClose} />;

  return (
    <Modal title="Issue / transfer" lede={`${item.quantity.toLocaleString("en-US")} ${item.unit} on hand at ${item.location}`} onClose={onClose}>
      <form noValidate onSubmit={onSubmit}>
        <div className="grid gap-3 px-4 py-3">
          <Field label="Quantity" error={errors.quantity}>
            <input className={fieldClass} inputMode="numeric" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </Field>
          <Field label="Destination" error={errors.destination}>
            <select className={fieldClass} value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value as typeof form.destination })}>
              {LOCATIONS.filter((location) => location !== item.location).map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </Field>
          <Field label="Well ID" error={errors.wellId}>
            <select className={fieldClass} value={form.wellId} onChange={(event) => setForm({ ...form, wellId: event.target.value })}>
              <option value="">Yard or terminal hold</option>
              {WELLS.map((well) => (
                <option key={well}>{well}</option>
              ))}
            </select>
          </Field>
          <Field label="Note" error={errors.note}>
            <textarea className={areaClass} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Delivery ticket, vessel, or work order" />
          </Field>
        </div>
        <Actions onClose={onClose} label="Issue" />
      </form>
    </Modal>
  );
}

export function ReorderDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { requestReorder } = useStore();
  const guard = useGuard();
  const suggested = Math.max(item.reorderPoint * 2 - item.quantity - item.onOrder, 1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    quantity: String(suggested),
    vendor: item.manufacturer,
    note: "",
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!guard.claim()) return;
    const parsed = reorderRequestSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      guard.release();
      return;
    }
    if (!requestReorder(item.id, parsed.data)) guard.release();
    else onClose();
  }

  return (
    <Modal title="Request reorder" lede={`${item.name} · minimum ${item.reorderPoint} ${item.unit}`} onClose={onClose}>
      <form noValidate onSubmit={onSubmit}>
        <div className="grid gap-3 px-4 py-3">
          <Field label="Quantity" error={errors.quantity}>
            <input className={fieldClass} inputMode="numeric" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </Field>
          <Field label="Vendor" error={errors.vendor}>
            <input className={fieldClass} list="petrovault-makers" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} />
          </Field>
          <Field label="Note" error={errors.note}>
            <textarea className={areaClass} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </Field>
        </div>
        <Actions onClose={onClose} label="Submit request" />
      </form>
    </Modal>
  );
}

export function ReceiveTransferDialog({ transfer, onClose }: { transfer: Transfer; onClose: () => void }) {
  const { receiveTransfer } = useStore();
  const guard = useGuard();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ bin: "", note: "" });
  const [ticketRoute, setTicketRoute] = useState<TicketRoute | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!guard.claim()) return;
    const parsed = receiveTransferSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      guard.release();
      return;
    }
    if (!receiveTransfer(transfer.id, parsed.data)) guard.release();
    else setTicketRoute({ from: transfer.from, to: transfer.to, wellId: transfer.wellId });
  }

  if (ticketRoute) return <TicketAfter route={ticketRoute} onClose={onClose} />;

  return (
    <Modal title="Confirm receipt" lede={`${transfer.quantity} ${transfer.unit} of ${transfer.itemName} into ${transfer.to}`} onClose={onClose}>
      <form noValidate onSubmit={onSubmit}>
        <div className="grid gap-3 px-4 py-3">
          <Field label="Receiving bin" error={errors.bin}>
            <input className={fieldClass} value={form.bin} onChange={(event) => setForm({ ...form, bin: event.target.value })} />
          </Field>
          <Field label="Note" error={errors.note}>
            <textarea className={areaClass} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </Field>
        </div>
        <Actions onClose={onClose} label="Confirm receipt" />
      </form>
    </Modal>
  );
}

export function DecideDialog({
  reorder,
  decision,
  onClose,
}: {
  reorder: Reorder;
  decision: "Approved" | "Rejected";
  onClose: () => void;
}) {
  const { decideReorder } = useStore();
  const guard = useGuard();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!guard.claim()) return;
    const parsed = decideSchema.safeParse({ note });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      guard.release();
      return;
    }
    if (!decideReorder(reorder.id, decision, parsed.data)) guard.release();
    else onClose();
  }

  return (
    <Modal
      title={decision === "Approved" ? "Approve reorder" : "Reject reorder"}
      lede={`${reorder.quantity} ${reorder.unit} · ${reorder.vendor} · ${reorder.sku}`}
      onClose={onClose}
    >
      <form noValidate onSubmit={onSubmit}>
        <div className="px-4 py-3">
          <Field label="Decision note" error={errors.note}>
            <textarea className={areaClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional. Written into the register." />
          </Field>
        </div>
        <Actions onClose={onClose} label={decision === "Approved" ? "Approve" : "Reject"} />
      </form>
    </Modal>
  );
}
