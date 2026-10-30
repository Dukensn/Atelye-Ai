import { efase, egal, ekri, json, kleTelefon, li, louvriSesyon, modpasBon, netwaye } from "../lib/store.js";
import { eleve } from "./espas.js";

const BLOKE_APRE = 5, BLOKE_MIN = 15;

// Log in with the WhatsApp number and password; returns a session key for this phone.
export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  if (b.kle_peman) return aprePeman(b);
  const telefon = netwaye(b.telefon, 20);
  const modpas = String(b.modpas ?? "").slice(0, 100);
  const pabon = json({ ere: "Nimewo a oswa modpas la pa bon." }, 401);
  if (telefon.replace(/\D/g, "").length < 8 || !modpas) return pabon;

  const i = await li(`telefon/${kleTelefon(telefon)}.json`);
  const e = i && (await li(`enskripsyon/${i.id}.json`));
  if (!e) return pabon;
  if (!e.modpas) return json({ ere: "Kont ou poko gen modpas. Louvri lyen nou te voye ba ou sou WhatsApp la pou w kreye l." }, 401);
  if (e.bloke_jiska && Date.parse(e.bloke_jiska) > Date.now())
    return json({ ere: `Twòp eseyaj. Tann ${BLOKE_MIN} minit epi eseye ankò.` }, 429);

  if (!modpasBon(modpas, e.modpas)) {
    e.echek = (e.echek ?? 0) + 1;
    if (e.echek >= BLOKE_APRE) { e.bloke_jiska = new Date(Date.now() + BLOKE_MIN * 6e4).toISOString(); e.echek = 0; }
    await ekri(`enskripsyon/${e.id}.json`, e);
    return pabon;
  }
  delete e.echek; delete e.bloke_jiska;

  if (e.estati !== "aksepte") {
    await ekri(`enskripsyon/${e.id}.json`, e);
    return json({ estati: e.estati, id: e.id, non: e.non.split(" ")[0] }, 403);
  }
  const kle = await louvriSesyon(e);
  await ekri(`enskripsyon/${e.id}.json`, e);
  return json({ kle });
}

// Straight after an online payment: the browser that registered holds a one-time key, so the student
// lands in the space without typing the password. Works once, and only after the payment is accepted.
async function aprePeman(b) {
  const id = netwaye(b.id, 40), k = String(b.kle_peman).slice(0, 64);
  const e = /^[0-9a-f-]{36}$/.test(id) && (await li(`enskripsyon/${id}.json`));
  if (!e || !e.kle_peman || !egal(k, e.kle_peman)) return json({ ere: "Konekte ak nimewo w ak modpas ou." }, 401);
  if (e.estati !== "aksepte") return json({ estati: e.estati }, 403);
  delete e.kle_peman;
  const kle = await louvriSesyon(e);
  await ekri(`enskripsyon/${e.id}.json`, e);
  return json({ kle });
}

// Log out this phone.
export async function DELETE(req) {
  const e = await eleve(req);
  if (!e) return json({ ok: true });
  const k = req.headers.get("x-kle").trim();
  await efase(`sesyon/${k}.json`).catch(() => {});
  e.sesyon = (e.sesyon ?? []).filter((t) => t !== k);
  await ekri(`enskripsyon/${e.id}.json`, e);
  return json({ ok: true });
}
