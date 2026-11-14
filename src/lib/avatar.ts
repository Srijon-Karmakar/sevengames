import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createAvatar, type Style } from "@dicebear/core";
import { supabase } from "../supabase";

/*
 * Avatar library (DiceBear). Avatars are generated in the browser as SVG, so there are
 * no image downloads and every seed gives a unique character.
 *
 * Only styles that need no attribution are used:
 *   CC0 1.0: pixel-art, lorelei, notionists, thumbs
 *   "Free for personal and commercial use": bottts, avataaars
 *
 * Each style is code-split and only loaded when it is first shown.
 */

type StyleModule = Style<Record<string, unknown>>;

export const AVATAR_STYLES = [
  { id: "pixel-art", label: "Pixel", load: () => import("@dicebear/pixel-art") },
  { id: "bottts", label: "Bots", load: () => import("@dicebear/bottts") },
  { id: "avataaars", label: "Toon", load: () => import("@dicebear/avataaars") },
  { id: "lorelei", label: "Sketch", load: () => import("@dicebear/lorelei") },
  { id: "notionists", label: "Ink", load: () => import("@dicebear/notionists") },
  { id: "thumbs", label: "Blob", load: () => import("@dicebear/thumbs") },
] as const;

export type AvatarStyleId = (typeof AVATAR_STYLES)[number]["id"];
export type AvatarChoice = { style: AvatarStyleId; seed: string };

// Brand-friendly backgrounds that read well on the dark UI (hex without #).
const BACKGROUNDS = ["1564ff", "f46000", "ff9443", "5e5ce6", "2a1a12", "0f766e", "b4235a"];

const STORAGE_KEY = "senevon:avatar";
const CHANGE_EVENT = "senevon:avatar-change";

const styleCache = new Map<string, Promise<StyleModule>>();
const uriCache = new Map<string, string>();

function isStyleId(value: unknown): value is AvatarStyleId {
  return AVATAR_STYLES.some((s) => s.id === value);
}

function loadStyle(id: AvatarStyleId): Promise<StyleModule> {
  let p = styleCache.get(id);
  if (!p) {
    const def = AVATAR_STYLES.find((s) => s.id === id)!;
    p = def.load().then((m) => m as unknown as StyleModule);
    styleCache.set(id, p);
  }
  return p;
}

/** Render an avatar to a data: URI (cached per style + seed). */
export async function renderAvatar({ style, seed }: AvatarChoice): Promise<string> {
  const key = `${style}|${seed}`;
  const hit = uriCache.get(key);
  if (hit) return hit;
  const mod = await loadStyle(style);
  const uri = createAvatar(mod, {
    seed,
    size: 128,
    backgroundColor: BACKGROUNDS,
    backgroundType: ["gradientLinear", "solid"],
  }).toDataUri();
  uriCache.set(key, uri);
  return uri;
}

/** Async data URI for any style/seed (used by the library grid). */
export function useAvatarUri(choice: AvatarChoice | null) {
  const key = choice ? `${choice.style}|${choice.seed}` : "";
  const [uri, setUri] = useState<string | null>(() => (key ? uriCache.get(key) ?? null : null));
  useEffect(() => {
    if (!choice) return;
    let alive = true;
    const cached = uriCache.get(key);
    if (cached) {
      setUri(cached);
      return;
    }
    setUri(null);
    void renderAvatar(choice).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return uri;
}

/** A batch of fresh seeds for the library grid (page = shuffle counter). */
export function seedsFor(base: string, page: number, count: number) {
  return Array.from({ length: count }, (_, i) => `${base}-${page}-${i}`);
}

type Stored = AvatarChoice & { uri?: string };

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Stored;
    return isStyleId(v?.style) && typeof v.seed === "string" ? v : null;
  } catch {
    return null;
  }
}

function writeStored(v: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the avatar still works for this session */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function fromMetadata(user: User | null): AvatarChoice | null {
  const a = user?.user_metadata?.avatar as Partial<AvatarChoice> | undefined;
  return a && isStyleId(a.style) && typeof a.seed === "string" ? { style: a.style, seed: a.seed } : null;
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * The current player's avatar. Saved on this device (with the rendered image, so it shows
 * instantly on the next visit) and, when signed in, in the account so it follows them.
 */
export function useAvatar(user: User | null) {
  const [state, setState] = useState<Stored>(() => {
    return readStored() ?? fromMetadata(user) ?? { style: "pixel-art", seed: user?.id ?? randomSeed() };
  });

  // Other components (nav, profile) changing the avatar.
  useEffect(() => {
    const sync = () => {
      const v = readStored();
      if (v) setState(v);
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Signing in on a new device: adopt the avatar saved in the account.
  useEffect(() => {
    const remote = fromMetadata(user);
    if (remote && (remote.style !== state.style || remote.seed !== state.seed)) {
      void renderAvatar(remote).then((uri) => writeStored({ ...remote, uri }));
    }
    // Only when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Make sure the image for the current choice is rendered and cached.
  useEffect(() => {
    if (state.uri) return;
    let alive = true;
    void renderAvatar(state).then((uri) => {
      if (alive) writeStored({ style: state.style, seed: state.seed, uri });
    });
    return () => {
      alive = false;
    };
  }, [state]);

  const choose = useCallback(
    async (choice: AvatarChoice) => {
      const uri = await renderAvatar(choice);
      writeStored({ ...choice, uri });
      if (user && supabase) {
        void supabase.auth.updateUser({ data: { avatar: { style: choice.style, seed: choice.seed } } });
      }
    },
    [user],
  );

  return { choice: { style: state.style, seed: state.seed } as AvatarChoice, uri: state.uri ?? null, choose };
}
