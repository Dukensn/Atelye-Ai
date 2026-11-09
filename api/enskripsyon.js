import { randomBytes, randomUUID } from "node:crypto";
import { ekri, hashModpas, json, kleTelefon, kodBon, li, modpasValab, netwaye } from "../lib/store.js";
import { dbPare, konferans } from "../lib/db.js";

// Workshop seat (manual payment): name, WhatsApp, MonCash/NatCash transaction number. Stored in Supabase.
async function enskriKonferans(b) {
  if (!dbPare()) return json({ ere: "Enskripsyon an poko louvri. Eseye ankò pita." }, 503);
  const non = netwaye(b.non, 80), telefon = netwaye(b.telefon, 20), tranzaksyon = netwaye(b.tranzaksyon, 40);
  const metod = b.metod === "natcash" ? "natcash" : "moncash";
  if (non.length < 2) return json({ ere: "Ekri non w." }, 400);
  if (telefon.replace(/\D/g, "").length < 8) return json({ ere: "Nimewo WhatsApp la pa bon." }, 400);
  if (tranzaksyon.length < 4) return json({ ere: "Ekri nimewo tranzaksyon an." }, 400);
  const telefon_kle = kleTelefon(telefon);
  if ((await konferans.paTelefon(telefon_kle)).some((x) => x.estati !== "refize"))
    return json({ ere: "Nimewo sa a enskri deja. N ap kontakte w sou WhatsApp." }, 409);
  try {
    const x = await konferans.mete({ non, telefon, telefon_kle, metod, tranzaksyon });
    return json({ ok: true, id: x.id });
  } catch (err) {
    if (/23505|duplicate/.test(String(err))) return json({ ere: "Nimewo sa a enskri deja. N ap kontakte w sou WhatsApp." }, 409);
    throw err;
  }
}

// Step 1: name, WhatsApp and a password. The payment proof comes in step 2 (api/prev.js).
export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  if (b?.tip === "konferans") return enskriKonferans(b);
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
  const e = { id: randomUUID(), non, telefon, modpas: hashModpas(b.modpas), kreye: new Date().toISOString(), estati: "san_prev",
    kle_peman: randomBytes(24).toString("base64url") };   // one-time login right after an online payment
  if (kodBon(ref)) e.ref = ref;
  await ekri(`enskripsyon/${e.id}.json`, e);
  await ekri(tk, { id: e.id });
  return json({ id: e.id, kle_peman: e.kle_peman });
}
