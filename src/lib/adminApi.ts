import { supabase } from "../supabase";

const TOKEN_KEY = "7games:admin-token";

export function getToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw) as { token: string; expires: number };
    return expires > Date.now() ? token : null;
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// deno-lint-ignore no-explicit-any
export async function adminCall<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new AdminError("Supabase is not configured", 0);
  const { data, error } = await supabase.functions.invoke("admin", {
    body: { action, token: getToken(), ...payload },
  });
  if (error) {
    // FunctionsHttpError carries the Response in `context`
    const res = (error as { context?: Response }).context;
    let message = error.message;
    let status = res?.status ?? 0;
    if (res) {
      try {
        const body = await res.clone().json();
        message = body.error ?? message;
        status = res.status;
      } catch {
        /* keep default */
      }
    }
    if (status === 401 && action !== "login") clearToken();
    throw new AdminError(message, status);
  }
  return data as T;
}

export async function login(password: string) {
  const res = await adminCall<{ token: string; expires: number }>("login", { password });
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(res));
  } catch {
    /* ignore */
  }
}

/** Upload an image straight to Cloudinary using a server-signed request. */
export async function uploadImage(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be under 8 MB");
  const sig = await adminCall<{
    cloud_name: string;
    api_key: string;
    timestamp: number;
    folder: string;
    signature: string;
  }>("upload_sign");
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.api_key);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
    method: "POST",
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
  return body.secure_url as string;
}
