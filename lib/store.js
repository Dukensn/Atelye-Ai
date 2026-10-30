import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";

// Price and affiliate commission are editable from /admin (paramet.json).
export const PARAMET_DEFO = { pri: 1500, komisyon: 300 };

export async function paramet() {
  return { ...PARAMET_DEFO, ...((await li("paramet.json")) ?? {}) };
}

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

// Course content: modules, each with lessons (YouTube links). Editable from /admin.
export const MODIL_DEFO = [
  {
    id: "stickman",
    tit: "Kreye videyo Stickman",
    deskripsyon: "Soti nan zewo rive nan premye videyo animasyon ou sou YouTube, avèk Claude ak zouti Atelye AI.",
    kouveti: "/kouveti/stickman.jpg",
    estati: "disponib",
    aprann: ["Kreye kat debi ou", "Louvri Claude epi enstale zouti a", "Chwazi yon lide epi dirije Claude", "Pibliye videyo w sou YouTube"],
    leson: [
      { tit: "Kreye kat debi ou", url: "" },
      { tit: "Soti nan zouti a rive sou YouTube", url: "" },
    ],
  },
  {
    id: "motion",
    tit: "Motion Video",
    deskripsyon: "Fè videyo motion design: tèks ki bouje, grafik, entwodiksyon ak reklam pou rezo sosyal.",
    kouveti: "/kouveti/motion.jpg",
    estati: "byento",
    aprann: ["Tèks ak tit anime", "Grafik ak chif ki bouje", "Entwodiksyon pou chèn YouTube ou", "Reklam kout pou TikTok ak Instagram"],
    leson: [],
  },
  {
    id: "higgsfield",
    tit: "Videyo AI ak Higgsfield",
    deskripsyon: "Kreye videyo AI ki sanble ak sinema: pèsonaj, sèn ak mouvman kamera, avèk Higgsfield ak Claude.",
    kouveti: "/kouveti/higgsfield.jpg",
    estati: "byento",
    aprann: ["Ekri bon prompt ak Claude", "Kreye pèsonaj ki rete menm jan", "Mouvman kamera sinema", "Monte yon videyo konplè"],
    leson: [],
  },
];

export const KONTNI_DEFO = {
  moduls: MODIL_DEFO,
  lyen_claude: "https://claude.ai/referral/uv5juLRukw",
  lyen_zouti: "https://github.com/Dukensn/Claude-motion-video-skill-",
  lyen_gid: "https://github.com/Dukensn/Claude-motion-video-skill-/blob/main/GUIDE-ELEVE.md",
  lyen_kominote: "https://chat.whatsapp.com/E9Z2o2MzywnGpu4OCImYnB",
  // The skill is public: students copy this prompt (with the skill link) and paste it into Claude.
  lyen_skill: "https://github.com/Dukensn/claude-motion-video-skill-/blob/main/skills/animated-video-studio/SKILL.md",
  prompt_skill:
    "Bonjou Claude! Mwen vle kreye yon videyo animasyon pou YouTube.\n\nTanpri, louvri skill sa a, li l nèt, epi swiv li etap pa etap:\n{lyen}\n\nPale avè m an kreyòl. Kòmanse pa montre m meni lide videyo yo ak imaj yo, epi mande m kiyès mwen vle.",
  zouti: [
    { non: "YouTube Studio", tex: "Pibliye epi swiv videyo w yo", url: "https://studio.youtube.com", dat: "2026-10-01T00:00:00.000Z" },
    { non: "Higgsfield", tex: "Videyo AI ki sanble ak sinema", url: "https://higgsfield.ai", dat: "2026-10-01T00:00:00.000Z" },
  ],
  nouvote: [
    { tit: "2 nouvo kou ap vini", tex: "Motion Video ak Videyo AI ak Higgsfield ap vini byento. Ale nan Kou pou w mande pou yo louvri.", dat: "2026-10-28T12:00:00.000Z" },
  ],
};

export async function kontni() {
  const anrejistre = (await li("kontni.json")) ?? {};
  const k = { ...KONTNI_DEFO, ...anrejistre };
  // Older saves had a flat "videyo" list: it becomes the lessons of module 1.
  if (k.videyo && !anrejistre.moduls) {
    k.moduls = MODIL_DEFO.map((m, i) => (i === 0 ? { ...m, leson: k.videyo.map((v) => ({ tit: v.tit.replace(/^Videyo \d+ — /, ""), url: v.url })) } : m));
  }
  // Older saves had a single "mesaj": it becomes the first news item.
  if (k.mesaj && !anrejistre.nouvote) k.nouvote = [{ tit: "", tex: k.mesaj, dat: "2026-10-28T00:00:00.000Z" }, ...k.nouvote];
  for (const c of ["lyen_skill", "prompt_skill"]) if (!k[c]) k[c] = KONTNI_DEFO[c];
  delete k.videyo;
  delete k.mesaj;
  return k;
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

// Affiliate codes: 6 characters, no look-alikes (0/O, 1/I).
const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const kodBon = (k) => /^[A-HJ-NP-Z2-9]{6}$/.test(k);

export async function asireKod(e) {
  if (e.kod) return false;
  for (;;) {
    const k = Array.from({ length: 6 }, () => ALFA[randomInt(ALFA.length)]).join("");
    if (!(await li(`kod/${k}.json`))) {
      await ekri(`kod/${k}.json`, { id: e.id });
      e.kod = k;
      return true;
    }
  }
}

export async function toutEnskripsyon() {
  return (await Promise.all((await lis("enskripsyon/")).map(li))).filter(Boolean);
}

export async function toutRetre() {
  return (await Promise.all((await lis("retre/")).map(li))).filter(Boolean);
}

// Earnings are derived from the records (approved referrals), never kept as a counter.
export function kalkileAfilye(e, tout, retre) {
  const filye = tout
    .filter((x) => e.kod && x.ref === e.kod && x.id !== e.id && x.estati !== "san_prev")
    .sort((a, b) => (b.dat_desizyon ?? b.kreye).localeCompare(a.dat_desizyon ?? a.kreye));
  const gen = filye.filter((x) => x.estati === "aksepte").reduce((s, x) => s + (x.komisyon ?? 0), 0);
  const mwen = retre.filter((r) => r.eleve_id === e.id);
  const sou = (est) => mwen.filter((r) => r.estati === est).reduce((s, r) => s + r.montan, 0);
  const peye = sou("peye"), atann = sou("atann");
  return {
    kod: e.kod ?? null,
    filye: filye.map((x) => ({
      non: x.non.split(" ")[0],
      estati: x.estati,
      montan: x.estati === "aksepte" ? x.komisyon ?? 0 : 0,
      dat: x.dat_desizyon ?? x.kreye,
    })),
    gen, peye, atann,
    balans: gen - peye - atann,
    retre: mwen.sort((a, b) => b.kreye.localeCompare(a.kreye)),
  };
}

// Passwords: scrypt with a random salt, stored as "scrypt$salt$hash".
export function hashModpas(m) {
  const sel = randomBytes(16).toString("base64url");
  return `scrypt$${sel}$${scryptSync(m, sel, 32).toString("base64url")}`;
}

export function modpasBon(m, anrejistre) {
  const [algo, sel, h] = String(anrejistre ?? "").split("$");
  if (algo !== "scrypt" || !sel || !h) return false;
  return egal(scryptSync(m, sel, 32).toString("base64url"), h);
}

export const modpasValab = (m) => typeof m === "string" && m.length >= 6 && m.length <= 100;

// One login index per WhatsApp number, so the same phone always finds the same account.
export const kleTelefon = (t) => telefonWhatsApp(String(t ?? ""));

// A login lives on at most MAX_APARÈY phones; a new login pushes the oldest one out.
export const MAX_APAREY = 2;
export async function louvriSesyon(e) {
  const tok = randomBytes(24).toString("base64url");
  await ekri(`sesyon/${tok}.json`, { id: e.id, kreye: new Date().toISOString() });
  const lis = [...(e.sesyon ?? []), tok];
  while (lis.length > MAX_APAREY) await efase(`sesyon/${lis.shift()}.json`).catch(() => {});
  e.sesyon = lis;
  return tok;
}

export async function fenmenTout(e) {
  for (const t of e.sesyon ?? []) await efase(`sesyon/${t}.json`).catch(() => {});
  e.sesyon = [];
}
