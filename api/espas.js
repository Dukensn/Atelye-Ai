import { asireKod, ekri, json, kalkileAfilye, kontni, li, paramet, toutEnskripsyon, toutRetre } from "../lib/store.js";

export async function eleve(req) {
  const k = (req.headers.get("x-kle") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(k)) return null;
  const t = await li(`token/${k}.json`);
  if (!t) return null;
  const e = await li(`enskripsyon/${t.id}.json`);
  return e && e.estati === "aksepte" && e.token === k ? e : null;
}

export async function GET(req) {
  const e = await eleve(req);
  if (!e) return json({ ere: "kle" }, 401);
  if (await asireKod(e)) await ekri(`enskripsyon/${e.id}.json`, e);
  const [k, p, tout, retre] = await Promise.all([kontni(), paramet(), toutEnskripsyon(), toutRetre()]);
  return json({
    non: e.non.split(" ")[0],
    nonKonple: e.non,
    telefon: e.telefon,
    depi: e.dat_desizyon ?? e.kreye,
    kontni: k,
    pri: p.pri,
    komisyon: p.komisyon,
    afilye: kalkileAfilye(e, tout, retre),
  });
}
