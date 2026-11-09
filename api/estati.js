import { PEMAN, json, kontni, li, netwaye, paramet } from "../lib/store.js";

// The app polls this while the student waits; once accepted it shows the login form (number + password).
// The id is a random UUID only that phone knows.
// /api/konfig is served here too (vercel.json rewrite): the Hobby plan allows 12 functions.
async function konfig() {
  const p = await paramet();
  return json({ pri: p.pri, komisyon: p.komisyon, lyen_peman: p.lyen_peman || "", tradui: !!p.tradui, manyel: p.manyel || !p.lyen_peman, otomatik: !!(process.env.KOBARA_SECRET_KEY && process.env.KOBARA_WEBHOOK_SECRET && p.otomatik), ...PEMAN });
}

export async function GET(req) {
  const u = new URL(req.url);
  if (u.pathname.endsWith("/konfig") || u.searchParams.has("konfig")) return konfig();
  const id = netwaye(new URL(req.url).searchParams.get("id"), 40);
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ ere: "id" }, 404);
  const e = await li(`enskripsyon/${id}.json`);
  if (!e) return json({ ere: "id" }, 404);
  const paye = e.estati === "atann" || e.estati === "aksepte";
  return json({
    estati: e.estati,
    non: e.non.split(" ")[0],
    ...(paye ? { kominote: (await kontni()).lyen_kominote } : {}),
    telefon: e.telefon,
  });
}
