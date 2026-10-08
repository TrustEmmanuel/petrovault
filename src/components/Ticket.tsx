import { Modal } from "./ui";

export type TicketModel = {
  reference: string;
  sku: string;
  itemName: string;
  quantity: number;
  unit: string;
  from: string;
  to: string;
  wellId: string;
  actor: string;
  hash: string;
};

export function DeliveryTicket({ ticket, onClose }: { ticket: TicketModel; onClose: () => void }) {
  return (
    <Modal title="Delivery ticket" lede={ticket.reference} onClose={onClose}>
      <div className="ticket-sheet px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500">PETROVAULT</p>
        <h3 className="mt-1 text-sm font-semibold text-zinc-950">{ticket.itemName}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <Row label="Reference" value={ticket.reference} />
          <Row label="SKU" value={ticket.sku} />
          <Row label="Quantity" value={`${ticket.quantity.toLocaleString("en-US")} ${ticket.unit}`} />
          <Row label="Actor" value={ticket.actor} />
          <Row label="From" value={ticket.from || "—"} />
          <Row label="To" value={ticket.to || "—"} />
          <Row label="Well ID" value={ticket.wellId || "—"} />
          <Row label="Register hash" value={ticket.hash || "—"} />
        </dl>
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 print:hidden">
        <button type="button" onClick={onClose} className="h-8 px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
          Close
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-8 border border-zinc-900 bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Print
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-zinc-950">{value}</dd>
    </div>
  );
}
