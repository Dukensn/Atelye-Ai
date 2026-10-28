import { randomUUID } from "node:crypto";
import { ekri, json, kalkileAfilye, netwaye, toutEnskripsyon, toutRetre } from "../lib/store.js";
import { eleve } from "./espas.js";

// The student asks to be paid the whole balance on MonCash or NatCash; the admin pays by hand.
export async function POST(req) {
  const e = await eleve(req);
  if (!e) return json({ ere: "Rekonekte w." }, 401);
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  const metod = b.metod === "natcash" ? "natcash" : b.metod === "moncash" ? "moncash" : null;
  const nimewo = netwaye(b.nimewo, 20);
  if (!metod) return json({ ere: "Chwazi MonCash oswa NatCash." }, 400);
  if (nimewo.replace(/\D/g, "").length < 8) return json({ ere: "Nimewo a pa bon." }, 400);

  const [tout, retre] = await Promise.all([toutEnskripsyon(), toutRetre()]);
  const a = kalkileAfilye(e, tout, retre);
  if (a.atann > 0) return json({ ere: "Ou gen yon demann k ap tann deja." }, 400);
  if (a.balans <= 0) return json({ ere: "Ou pa gen kòb pou retire pou kounye a." }, 400);

  const r = {
    id: randomUUID(), eleve_id: e.id, non: e.non, telefon: e.telefon,
    montan: a.balans, metod, nimewo, estati: "atann", kreye: new Date().toISOString(),
  };
  await ekri(`retre/${r.id}.json`, r);
  return json({ ok: true, retre: r });
}
