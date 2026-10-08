import { appDataSchema, sessionSchema } from "./schema";
import { seedData } from "../data/seed";
import type { AppData, Session } from "../types";

const DATA_KEY = "petrovault.state.v2";
const SESSION_KEY = "petrovault.session.v2";

export function loadState(): { data: AppData; rebuilt: boolean } {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return { data: seedData(), rebuilt: false };
    const parsed = appDataSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { data: seedData(), rebuilt: true };
    return { data: parsed.data, rebuilt: false };
  } catch {
    return { data: seedData(), rebuilt: true };
  }
}

export function saveState(data: AppData) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
