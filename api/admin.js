import { randomBytes } from "node:crypto";
import {
  asireKod, efase, ekri, json, kalkileAfilye, kontni, li, netwaye, paramet, seAdmin,
  telefonWhatsApp, toutEnskripsyon, toutRetre,
} from "../lib/store.js";

const lyenEspas = (req, token) => `${new URL(req.url).origin}/espas?k=${token}`;

function mesajWhatsApp(e, lyen, kominote) {
  const premye = e.non.split(" ")[0];
  const tèks =
    `Bonjou ${premye}! Nou resevwa peman w lan pou Atelier AI. Men lyen espas ou: ${lyen}\nPa pataje l ak pèsonn, se pa w sèlman li ye.` +
    (kominote ? `\n\nRejwenn kominote WhatsApp la tou, se la w ap jwenn enfòmasyon ak akonpayman: ${kominote}` : "");
  return `https://wa.me/${telefonWhatsApp(e.telefon)}?text=${encodeURIComponent(tèks)}`;
}

const waGen = (moun, montan, filye) =>
  `https://wa.me/${telefonWhatsApp(moun.telefon)}?text=${encodeURIComponent(
    `Felisitasyon ${moun.non.split(" ")[0]}! 🎉 ${filye.split(" ")[0]} enskri nan Atelier AI ak lyen pa w la. Ou fèk genyen ${montan} goud. Louvri app Atelier AI a pou w wè kòb ou.`,
  )}`;

const waPeye = (r) =>
  `https://wa.me/${telefonWhatsApp(r.telefon)}?text=${encodeURIComponent(
    `Bonjou ${r.non.split(" ")[0]}! Nou fèk voye ${r.montan} goud sou ${r.metod === "moncash" ? "MonCash" : "NatCash"} ${r.nimewo}. Mèsi paske w pataje Atelier AI! 🙏`,
  )}`;

export async function GET(req) {
  if (!seAdmin(req)) return json({ ere: "Modpas la pa bon." }, 401);
  const [tout, retre, k, p] = await Promise.all([toutEnskripsyon(), toutRetre(), kontni(), paramet()]);
  const parKod = Object.fromEntries(tout.filter((e) => e.kod).map((e) => [e.kod, e]));
  const lisFinal = tout
    .sort((a, b) => b.kreye.localeCompare(a.kreye))
    .map((e) => ({
      ...e,
      parenn: e.ref && parKod[e.ref] ? parKod[e.ref].non : null,
      lyen: e.token ? lyenEspas(req, e.token) : null,
      whatsapp: e.token ? mesajWhatsApp(e, lyenEspas(req, e.token), k.lyen_kominote) : null,
    }));
  const afilye = tout
    .filter((e) => e.kod)
    .map((e) => {
      const a = kalkileAfilye(e, tout, retre);
      return { id: e.id, non: e.non, telefon: e.telefon, kod: e.kod, filye: a.filye.length,
        aksepte: a.filye.filter((f) => f.estati === "aksepte").length, gen: a.gen, peye: a.peye, atann: a.atann, balans: a.balans };
    })
    .filter((a) => a.filye > 0)
    .sort((a, b) => b.gen - a.gen);
  const retreFinal = retre
    .sort((a, b) => b.kreye.localeCompare(a.kreye))
    .map((r) => ({ ...r, whatsapp: waPeye(r) }));
  return json({ lis: lisFinal, kontni: k, paramet: p, afilye, retre: retreFinal });
}

export async function POST(req) {
  if (!seAdmin(req)) return json({ ere: "Modpas la pa bon." }, 401);
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }

  if (b.aksyon === "kontni") {
    const k = b.kontni ?? {};
    const url = (v) => {
      const x = netwaye(v, 500);
      return x === "" || /^https:\/\//.test(x) ? x : null;
    };
    const imaj = (v) => {
      const x = netwaye(v, 500);
      return x === "" || /^https:\/\//.test(x) || /^\/kouveti\/[\w.-]+$/.test(x) ? x : null;
    };
    const moduls = (Array.isArray(k.moduls) ? k.moduls : []).slice(0, 20).map((m, i) => ({
      id: netwaye(m?.id, 40).replace(/[^\w-]/g, "") || `m${Date.now()}${i}`,
      tit: netwaye(m?.tit, 100),
      deskripsyon: netwaye(m?.deskripsyon, 600),
      kouveti: imaj(m?.kouveti),
      estati: m?.estati === "byento" ? "byento" : "disponib",
      aprann: (Array.isArray(m?.aprann) ? m.aprann : []).map((x) => netwaye(x, 120)).filter(Boolean).slice(0, 12),
      leson: (Array.isArray(m?.leson) ? m.leson : []).slice(0, 50).map((l) => ({ tit: netwaye(l?.tit, 120), url: url(l?.url) })),
    }));
    if (moduls.some((m) => !m.tit)) return json({ ere: "Chak modil bezwen yon tit." }, 400);
    const nouvo = {
      moduls,
      lyen_claude: url(k.lyen_claude),
      lyen_zouti: url(k.lyen_zouti),
      lyen_gid: url(k.lyen_gid),
      lyen_kominote: url(k.lyen_kominote),
      mesaj: netwaye(k.mesaj, 1000),
    };
    const lyen = [nouvo.lyen_claude, nouvo.lyen_zouti, nouvo.lyen_gid, nouvo.lyen_kominote, ...moduls.flatMap((m) => m.leson.map((l) => l.url))];
    if (lyen.some((x) => x === null) || moduls.some((m) => m.kouveti === null))
      return json({ ere: "Chak lyen dwe kòmanse ak https://" }, 400);
    await ekri("kontni.json", nouvo);
    return json({ ok: true, kontni: nouvo });
  }

  if (b.aksyon === "paramet") {
    const pri = Math.round(Number(b.pri)), komisyon = Math.round(Number(b.komisyon));
    if (!(pri >= 100 && pri <= 1000000)) return json({ ere: "Pri a pa bon." }, 400);
    if (!(komisyon >= 0 && komisyon < pri)) return json({ ere: "Komisyon an dwe pi piti pase pri a." }, 400);
    await ekri("paramet.json", { pri, komisyon });
    return json({ ok: true, paramet: { pri, komisyon } });
  }

  if (b.aksyon === "retre_peye" || b.aksyon === "retre_anile") {
    const rid = netwaye(b.id, 40);
    const r = /^[0-9a-f-]{36}$/.test(rid) ? await li(`retre/${rid}.json`) : null;
    if (!r) return json({ ere: "Demann sa a pa egziste." }, 404);
    r.estati = b.aksyon === "retre_peye" ? "peye" : "anile";
    r.dat_desizyon = new Date().toISOString();
    await ekri(`retre/${r.id}.json`, r);
    return json({ ok: true, whatsapp: r.estati === "peye" ? waPeye(r) : null });
  }

  const id = netwaye(b.id, 40);
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ ere: "Demann sa a pa egziste." }, 404);
  const e = await li(`enskripsyon/${id}.json`);
  if (!e) return json({ ere: "Demann sa a pa egziste." }, 404);

  if (b.aksyon === "aksepte") {
    if (!e.token) {
      e.token = randomBytes(24).toString("base64url");
      await ekri(`token/${e.token}.json`, { id: e.id });
    }
    await asireKod(e);
    // Credit the referrer once, at the commission in force on the day of approval.
    let parenn = null;
    if (e.ref && e.komisyon === undefined) {
      const ki = await li(`kod/${e.ref}.json`);
      const p = ki && ki.id !== e.id ? await li(`enskripsyon/${ki.id}.json`) : null;
      if (p && p.estati === "aksepte") {
        e.komisyon = (await paramet()).komisyon;
        parenn = p;
      }
    }
    e.estati = "aksepte";
    e.dat_desizyon = new Date().toISOString();
    await ekri(`enskripsyon/${e.id}.json`, e);
    const lyen = lyenEspas(req, e.token);
    return json({
      ok: true, lyen,
      whatsapp: mesajWhatsApp(e, lyen, (await kontni()).lyen_kominote),
      parenn: parenn ? { non: parenn.non, montan: e.komisyon, whatsapp: waGen(parenn, e.komisyon, e.non) } : null,
    });
  }

  if (b.aksyon === "refize") {
    if (e.token) await efase(`token/${e.token}.json`);
    e.estati = "refize";
    delete e.token;
    e.dat_desizyon = new Date().toISOString();
    await ekri(`enskripsyon/${e.id}.json`, e);
    return json({ ok: true });
  }

  return json({ ere: "Aksyon sa a pa egziste." }, 400);
}
