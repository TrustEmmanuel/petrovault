import { todayKey } from "./format";
import type { Movement, MovementDraft } from "../types";

export function movementPayload(
  prev: string,
  movement: Pick<
    MovementDraft,
    "at" | "role" | "action" | "sku" | "quantity" | "destination" | "wellId" | "note"
  >,
) {
  return [
    prev,
    movement.at,
    movement.role,
    movement.action,
    movement.sku,
    String(movement.quantity),
    movement.destination,
    movement.wellId,
    movement.note,
  ].join("|");
}

export function fnv1a(input: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function appendMovement(movements: Movement[], draft: MovementDraft): Movement[] {
  const prev = movements.at(-1)?.hash ?? "00000000";
  const hash = fnv1a(movementPayload(prev, draft));
  const day = todayKey(new Date(draft.at)).replaceAll("-", "");
  const row: Movement = {
    ...draft,
    prevHash: prev,
    hash,
    reference: `PV-${day}-${hash.slice(0, 4).toUpperCase()}`,
  };
  return [...movements, row];
}

export function verifyChain(movements: Movement[]) {
  let prev = "00000000";
  for (const movement of movements) {
    const hash = fnv1a(movementPayload(prev, movement));
    if (movement.prevHash !== prev || movement.hash !== hash) {
      return { ok: false as const, reference: movement.reference, count: movements.length };
    }
    prev = movement.hash;
  }
  return { ok: true as const, count: movements.length, tip: prev };
}
