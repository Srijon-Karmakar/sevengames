import { supabase } from "../supabase";
import { loadSettings } from "./siteSettings";

const VISITOR_KEY = "7games:visitor";

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id || id.length < 8) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2, 12);
  }
}

function deviceKind(): string {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

type EventType = "pageview" | "game_start" | "game_finish";

async function send(row: {
  type: EventType;
  path?: string;
  game_id?: string;
  score?: number;
  referrer?: string | null;
}) {
  if (!supabase) return;
  const settings = await loadSettings();
  if (!settings.tracking_enabled) return;
  try {
    await supabase.from("events").insert({
      visitor_id: visitorId(),
      device: deviceKind(),
      ...row,
    });
  } catch {
    /* analytics must never break the app */
  }
}

let lastPath = "";

export function trackPageview(path: string) {
  if (path.startsWith("/admin") || path === lastPath) return;
  const first = lastPath === "";
  lastPath = path;
  let referrer: string | null = null;
  if (first && document.referrer) {
    try {
      // Ignore self-referrals
      if (new URL(document.referrer).host !== location.host) referrer = document.referrer.slice(0, 300);
    } catch {
      /* ignore */
    }
  }
  void send({ type: "pageview", path: path.slice(0, 200), referrer });
}

export function trackGame(type: "game_start" | "game_finish", gameId: string, score?: number) {
  void send({ type, game_id: gameId, path: `/game/${gameId}`, score: score ?? undefined });
}

export function trackAd(adId: string, kind: "impression" | "click") {
  if (!supabase) return;
  void Promise.resolve(
    supabase.rpc("record_ad_event", {
      p_ad: adId,
      p_kind: kind,
      p_visitor: visitorId(),
      p_path: location.pathname,
    }),
  ).catch(() => undefined);
}
