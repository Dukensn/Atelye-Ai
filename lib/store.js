import { timingSafeEqual } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";

export const PRI = 1500;

export const PEMAN = {
  natcash: process.env.NATCASH_NIMEWO || "3582 8339",
  moncash: process.env.MONCASH_NIMEWO || "3864 9724",
  benefisye: process.env.NON_BENEFISYE || "Dukens Mathieu",
};

// Data lives in a private Vercel Blob store, one JSON file per record.
// ATELIER_MEMWA=1 swaps it for an in-memory map (local tests only).
const memwa = process.env.ATELIER_MEMWA === "1" ? new Map() : null;

export async function li(chemen) {
  if (memwa) return memwa.has(chemen) ? JSON.parse(memwa.get(chemen)) : null;
  const r = await get(chemen, { access: "private", useCache: false });
  if (!r) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function ekri(chemen, done) {
  const body = JSON.stringify(done);
  if (memwa) return void memwa.set(chemen, body);
  await put(chemen, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

// Payment proof photos (JPEG), private like everything else.
export async function ekriFoto(chemen, buf) {
  if (memwa) return void memwa.set(chemen, buf.toString("base64"));
  await put(chemen, buf, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "image/jpeg",
    cacheControlMaxAge: 60,
  });
}

export async function liFoto(chemen) {
  if (memwa) return memwa.has(chemen) ? Buffer.from(memwa.get(chemen), "base64") : null;
  const r = await get(chemen, { access: "private", useCache: false });
  return r ? Buffer.from(await new Response(r.stream).arrayBuffer()) : null;
}

export async function efase(chemen) {
  if (memwa) return void memwa.delete(chemen);
  await del(chemen);
}

export async function lis(prefiks) {
  if (memwa) return [...memwa.keys()].filter((k) => k.startsWith(prefiks));
  const chemen = [];
  let cursor;
  do {
    const r = await list({ prefix: prefiks, cursor, limit: 1000 });
    chemen.push(...r.blobs.map((b) => b.pathname));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return chemen;
}

export const KONTNI_DEFO = {
  videyo: [
    { tit: "Videyo 1 — Kreye kat debi ou", url: "" },
    { tit: "Videyo 2 — Soti nan zouti a rive sou YouTube", url: "" },
  ],
  lyen_claude: "https://claude.ai/referral/uv5juLRukw",
  lyen_zouti: "https://github.com/Dukensn/Claude-motion-video-skill-",
  lyen_gid: "https://github.com/Dukensn/Claude-motion-video-skill-/blob/main/GUIDE-ELEVE.md",
  lyen_kominote: "https://chat.whatsapp.com/E9Z2o2MzywnGpu4OCImYnB",
  mesaj: "",
};

export async function kontni() {
  return { ...KONTNI_DEFO, ...((await li("kontni.json")) ?? {}) };
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export function egal(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function seAdmin(req) {
  const modpas = process.env.ADMIN_MODPAS ?? "";
  return modpas.length >= 8 && egal(req.headers.get("x-admin") ?? "", modpas);
}

export function netwaye(v, max) {
  return String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

// Haitian numbers: 8 digits locally, 509 + 8 digits internationally.
export function telefonWhatsApp(t) {
  const d = t.replace(/\D/g, "");
  return d.length === 8 ? "509" + d : d;
}
