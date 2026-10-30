import { efase, ekri, hashModpas, json, kleTelefon, li, louvriSesyon, modpasValab, netwaye } from "../lib/store.js";

// One-time link from WhatsApp (older students, or after the admin resets a password):
// the student picks a password, the link stops working and this phone is logged in.
async function pa(k) {
  const kle = netwaye(k, 80);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(kle)) return null;
  const t = await li(`token/${kle}.json`);
  const e = t && (await li(`enskripsyon/${t.id}.json`));
  return e && e.estati === "aksepte" && e.token === kle ? e : null;
}

export async function GET(req) {
  const e = await pa(new URL(req.url).searchParams.get("k"));
  if (!e) return json({ ere: "Lyen sa a pa mache ankò." }, 404);
  return json({ non: e.non.split(" ")[0], telefon: e.telefon });
}

export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  const e = await pa(b.k);
  if (!e) return json({ ere: "Lyen sa a pa mache ankò. Konekte ak nimewo w ak modpas ou." }, 404);
  if (!modpasValab(b.modpas)) return json({ ere: "Modpas la dwe gen omwen 6 karaktè." }, 400);
  e.modpas = hashModpas(b.modpas);
  await efase(`token/${e.token}.json`).catch(() => {});
  delete e.token;
  await ekri(`telefon/${kleTelefon(e.telefon)}.json`, { id: e.id });
  const kle = await louvriSesyon(e);
  await ekri(`enskripsyon/${e.id}.json`, e);
  return json({ kle });
}
