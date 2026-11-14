import { useEffect, useState } from "react";

/** Games opened on this device, newest first. Stored locally; no account needed. */
export type RecentEntry = { id: string; at: number };

const KEY = "7games:recent";
const MAX = 8;
const EVENT = "7games:recent-change";

function read(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    return Array.isArray(list) ? list.filter((e) => typeof e?.id === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecent(id: string) {
  try {
    const next = [{ id, at: Date.now() }, ...read().filter((e) => e.id !== id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
}

export function useRecent() {
  const [list, setList] = useState<RecentEntry[]>(read);
  useEffect(() => {
    const sync = () => setList(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return list;
}

export function timeAgo(at: number) {
  const s = Math.max(1, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
