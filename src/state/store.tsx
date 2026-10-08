import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ToastViewport } from "../components/ui";
import { seedData } from "../data/seed";
import type { DecideInput, EditInput, IssueInput, NewItem, ReceiveInput, ReorderInput, CheckInInput } from "../lib/schema";
import { loadSession, loadState, saveSession, saveState } from "../lib/storage";
import { PERSONAS, type Role, type Session } from "../types";
import {
  applyAdd,
  applyCheckIn,
  applyDecide,
  applyEdit,
  applyIssue,
  applyReceiveTransfer,
  applyRequestReorder,
  type MutationResult,
} from "./mutations";

interface Toast {
  id: string;
  message: string;
  tone: "good" | "bad" | "info";
}

interface StoreApi {
  data: ReturnType<typeof loadState>["data"];
  session: Session | null;
  toasts: Toast[];
  dismissToast: (id: string) => void;
  signIn: (role: Role) => void;
  signOut: () => void;
  switchRole: (role: Role) => void;
  resetDemo: () => void;
  addItem: (input: NewItem) => boolean;
  editItem: (itemId: string, input: EditInput) => boolean;
  checkIn: (itemId: string, input: CheckInInput) => boolean;
  issue: (itemId: string, input: IssueInput) => boolean;
  receiveTransfer: (transferId: string, input: ReceiveInput) => boolean;
  requestReorder: (itemId: string, input: ReorderInput) => boolean;
  decideReorder: (reorderId: string, decision: "Approved" | "Rejected", input: DecideInput) => boolean;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot] = useState(loadState);
  const [data, setData] = useState(boot.data);
  const [session, setSession] = useState<Session | null>(() => {
    const saved = loadSession();
    if (!saved) return null;
    return { ...saved, ...PERSONAS[saved.role] };
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dataRef = useRef(data);
  const sessionRef = useRef(session);
  const storageFailed = useRef(false);
  dataRef.current = data;
  sessionRef.current = session;

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: Toast["tone"]) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    if (!boot.rebuilt) return;
    const id = "rebuilt";
    setToasts([{ id, message: "Stored data failed validation and the demo baseline was restored.", tone: "info" }]);
  }, [boot.rebuilt]);

  useEffect(() => {
    try {
      saveState(data);
    } catch {
      if (storageFailed.current) return;
      storageFailed.current = true;
      notify("This browser blocked local storage. Changes last for this visit only.", "bad");
    }
  }, [data, notify]);

  useEffect(() => {
    try {
      saveSession(session);
    } catch {
      storageFailed.current = true;
    }
  }, [session]);

  const commit = useCallback(
    (mutate: (current: typeof data, active: Session) => MutationResult) => {
      const active = sessionRef.current;
      if (!active) {
        notify("Sign in before changing stock.", "bad");
        return false;
      }
      const result = mutate(dataRef.current, active);
      if (!result.ok) {
        notify(result.message, "bad");
        return false;
      }
      dataRef.current = result.data;
      setData(result.data);
      notify(result.message, "good");
      return true;
    },
    [notify],
  );

  const api = useMemo<StoreApi>(
    () => ({
      data,
      session,
      toasts,
      dismissToast,
      signIn(role) {
        const persona = PERSONAS[role];
        const next: Session = { role, ...persona, signedInAt: new Date().toISOString() };
        sessionRef.current = next;
        setSession(next);
      },
      signOut() {
        sessionRef.current = null;
        setSession(null);
      },
      switchRole(role) {
        const persona = PERSONAS[role];
        setSession((current) => {
          const next: Session = {
            role,
            ...persona,
            signedInAt: current?.signedInAt ?? new Date().toISOString(),
          };
          sessionRef.current = next;
          return next;
        });
        notify(`Viewing as ${persona.title}.`, "info");
      },
      resetDemo() {
        const next = seedData();
        dataRef.current = next;
        setData(next);
        notify("Demo data restored.", "info");
      },
      addItem: (input) => commit((current, active) => applyAdd(current, active, input)),
      editItem: (itemId, input) => commit((current, active) => applyEdit(current, active, itemId, input)),
      checkIn: (itemId, input) => commit((current, active) => applyCheckIn(current, active, itemId, input)),
      issue: (itemId, input) => commit((current, active) => applyIssue(current, active, itemId, input)),
      receiveTransfer: (transferId, input) =>
        commit((current, active) => applyReceiveTransfer(current, active, transferId, input)),
      requestReorder: (itemId, input) =>
        commit((current, active) => applyRequestReorder(current, active, itemId, input)),
      decideReorder: (reorderId, decision, input) =>
        commit((current, active) => applyDecide(current, active, reorderId, decision, input)),
    }),
    [commit, data, dismissToast, notify, session, toasts],
  );

  return (
    <StoreContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </StoreContext.Provider>
  );
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used within StoreProvider");
  return store;
}
