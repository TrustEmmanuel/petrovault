export type InventoryFocus = {
  location?: string;
  itemId?: string;
};

let pending: InventoryFocus | null = null;
const listeners = new Set<() => void>();

export function openInventory(focus: InventoryFocus) {
  pending = focus;
  window.location.hash = "inventory";
  listeners.forEach((listener) => listener());
}

export function peekInventoryFocus() {
  return pending;
}

export function clearInventoryFocus() {
  pending = null;
}

export function subscribeInventoryFocus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
