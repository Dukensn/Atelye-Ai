import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

export const PRI = 1500;

// One record per key (one writer each), so Blobs is enough for this small site.
export const store = () => getStore({ name: "atelier", consistency: "strong" });

export type Enskripsyon = {
  id: string;
  non: string;
  telefon: string;
  imel: string;
  metod: "moncash" | "natcash";
  tranzaksyon: string;
  kreye: string;
  estati: "atann" | "aksepte" | "refize";
  token?: string;
  dat_desizyon?: string;
};

export type Kontni = {
  videyo: { tit: string; url: string }[];
  lyen_claude: string;
  lyen_zouti: string;
  lyen_gid: string;
  mesaj: string;
};

export const KONTNI_DEFO: Kontni = {
  videyo: [
    { tit: "Videyo 1 — Kreye kat debi ou", url: "" },
    { tit: "Videyo 2 — Soti nan zouti a rive sou YouTube", url: "" },
  ],
  lyen_claude: "",
  lyen_zouti: "https://github.com/Dukensn/Claude-motion-video-skill-",
  lyen_gid: "https://github.com/Dukensn/Claude-motion-video-skill-/blob/main/GUIDE-ELEVE.md",
  mesaj: "",
};

export async function kontni(): Promise<Kontni> {
  const k = (await store().get("kontni", { type: "json" })) as Partial<Kontni> | null;
  return { ...KONTNI_DEFO, ...(k ?? {}) };
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export function egal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function seAdmin(req: Request) {
  const modpas = Netlify.env.get("ADMIN_MODPAS") ?? "";
  const bay = req.headers.get("x-admin") ?? "";
  return modpas.length >= 8 && egal(bay, modpas);
}

export function netwaye(v: unknown, max: number) {
  return String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

// Haitian numbers: 8 digits locally, 509 + 8 digits internationally.
export function telefonWhatsApp(t: string) {
  const d = t.replace(/\D/g, "");
  return d.length === 8 ? "509" + d : d;
}
