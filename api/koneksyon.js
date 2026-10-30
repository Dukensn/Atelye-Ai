import { efase, ekri, json, kleTelefon, li, louvriSesyon, modpasBon, netwaye } from "../lib/store.js";
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
