import { randomUUID } from "node:crypto";
import { ekri, hashModpas, json, kleTelefon, kodBon, li, modpasValab, netwaye } from "../lib/store.js";

// Step 1: name, WhatsApp and a password. The payment proof comes in step 2 (api/prev.js).
export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  const non = netwaye(b.non, 80);
  const telefon = netwaye(b.telefon, 20);
  if (non.length < 2) return json({ ere: "Ekri non w." }, 400);
  if (telefon.replace(/\D/g, "").length < 8) return json({ ere: "Nimewo WhatsApp la pa bon." }, 400);
  if (!modpasValab(b.modpas)) return json({ ere: "Modpas la dwe gen omwen 6 karaktè." }, 400);

  const tk = `telefon/${kleTelefon(telefon)}.json`;
  const deja = await li(tk);
  const ansyen = deja && (await li(`enskripsyon/${deja.id}.json`));
  if (ansyen && (ansyen.estati === "aksepte" || ansyen.estati === "atann"))
    return json({ ere: "Nimewo sa a gen yon kont deja. Konekte w nan espas elèv la." }, 409);

  const ref = String(b.ref ?? "").toUpperCase();
  const e = { id: randomUUID(), non, telefon, modpas: hashModpas(b.modpas), kreye: new Date().toISOString(), estati: "san_prev" };
  if (kodBon(ref)) e.ref = ref;
  await ekri(`enskripsyon/${e.id}.json`, e);
  await ekri(tk, { id: e.id });
  return json({ id: e.id });
}
