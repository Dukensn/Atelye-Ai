import { createHmac } from "node:crypto";
import { aksepte, egal, ekri, json, li } from "../lib/store.js";

// Kobara calls this URL when a payment changes. Header Kobara-Signature: "t=<unix>,v1=<hex>",
// the HMAC-SHA256 of "<t>.<raw body>" with the webhook secret; older than 5 minutes is refused.
export function siyatiBon(kò, siyati, sekrè, kounye = Date.now() / 1000) {
  if (!kò || !siyati || !sekrè) return false;
  const pati = Object.fromEntries(siyati.split(",").map((x) => x.trim().split("=")).filter((x) => x.length === 2));
  const t = /^\d+$/.test(pati.t ?? "") ? Number(pati.t) : 0;
  if (!t || !/^[a-f0-9]{64}$/i.test(pati.v1 ?? "") || Math.abs(kounye - t) > 300) return false;
  return egal(createHmac("sha256", sekrè).update(`${t}.${kò}`).digest("hex"), pati.v1.toLowerCase());
}

const REYISI = /^(succeeded|success|completed|complete|paid|successful)$/i;

export async function POST(req) {
  const kò = await req.text();
  if (!siyatiBon(kò, req.headers.get("kobara-signature"), process.env.KOBARA_WEBHOOK_SECRET)) {
    console.error("kobara webhook: bad signature");
    return json({ ere: "siyati" }, 401);
  }
  let ev;
  try {
    ev = JSON.parse(kò);
  } catch {
    return json({ ere: "json" }, 400);
  }
  // The payment can sit at the top, under data, or under data.object depending on the event version.
  const o = ev.data?.object ?? ev.data ?? ev;
  const tip = String(ev.type ?? ev.event ?? "");
  console.log("kobara webhook", tip, o.status, o.id, JSON.stringify(Object.keys(o)));
  const peye = /payment\.(succeeded|success|completed|paid)$/i.test(tip) || (!/fail|cancel|expire|refund/i.test(tip) && REYISI.test(String(o.status ?? "")));
  if (!peye) return json({ ok: true });

  let ref = o.metadata?.ref;
  if (!(typeof ref === "string" && /^AT-[\w-]{1,40}$/.test(ref)) && o.id && /^[\w-]{1,80}$/.test(String(o.id))) ref = (await li(`kobara-id/${o.id}.json`))?.ref;
  const k = typeof ref === "string" && /^AT-[\w-]{1,40}$/.test(ref) ? await li(`kobara/${ref}.json`) : null;
  if (!k) return json({ ok: true, inkoni: true });
  const e = await li(`enskripsyon/${k.id}.json`);
  if (!e) return json({ ok: true, inkoni: true });
  if (e.estati === "aksepte") return json({ ok: true });   // already done (webhooks can repeat)
  const montan = o.amount ?? o.amount_paid;
  if (montan !== undefined && Number(montan) < k.montan) {
    console.error("kobara webhook: amount too low", ref, montan, k.montan);
    e.kobara_pwoblem = `Montan ${montan} pi piti pase ${k.montan}`;
    await ekri(`enskripsyon/${e.id}.json`, e);
    return json({ ok: true });
  }
  await aksepte(e, { peman: "kobara", kobara_tranzaksyon: String(o.id ?? ""), kobara_montan: Number(montan ?? k.montan), kobara_metod: String(o.provider ?? o.method ?? "") });
  return json({ ok: true });
}
