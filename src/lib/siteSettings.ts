import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export type SiteSettings = {
  ads_enabled: boolean;
  ad_rotate_seconds: number;
  tracking_enabled: boolean;
  announcement_enabled: boolean;
  announcement_text: string;
};

export const defaultSettings: SiteSettings = {
  ads_enabled: true,
  ad_rotate_seconds: 8,
  tracking_enabled: true,
  announcement_enabled: false,
  announcement_text: "",
};

let cache: SiteSettings | null = null;
let inflight: Promise<SiteSettings> | null = null;

export function loadSettings(): Promise<SiteSettings> {
  if (cache) return Promise.resolve(cache);
  if (!supabase) return Promise.resolve(defaultSettings);
  inflight ??= Promise.resolve(supabase.from("site_settings").select("key, value")).then(
    ({ data }) => {
      const merged: Record<string, unknown> = { ...defaultSettings };
      for (const row of data ?? []) merged[row.key] = row.value;
      cache = merged as SiteSettings;
      return cache;
    },
    () => defaultSettings,
  );
  return inflight;
}

/** Synchronous read for non-React code (e.g. the tracker). Null until loaded. */
export function peekSettings() {
  return cache;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cache ?? defaultSettings);
  useEffect(() => {
    let alive = true;
    void loadSettings().then((s) => alive && setSettings(s));
    return () => {
      alive = false;
    };
  }, []);
  return settings;
}
