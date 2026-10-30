import { createHmac } from "node:crypto";
import { aksepte, egal, ekri, json, li } from "../lib/store.js";

// MonCashConnect calls this URL when a payment changes. The body is signed with the webhook secret
// (header x-moncashconnect-signature); a confirmed payment opens the student's access at once.

// HMAC-SHA256 of the raw body, as hex or base64, optionally prefixed "sha256=",
// or the timestamped form "t=<ts>,v1=<hex>" signed over "<ts>.<body>".
export function siyatiBon(kò, siyati, sekrè) {
  if (!siyati || !sekrè) return false;
  const h = (s) => createHmac("sha256", sekrè).update(s);
  const pati = Object.fromEntries(siyati.split(",").map((x) => x.trim().split("=")).filter((x) => x.length === 2));
  if (pati.t && pati.v1) return egal(h(`${pati.t}.${kò}`).digest("hex"), pati.v1);
  const s = siyati.replace(/^sha256=/, "").trim();
  return egal(h(kò).digest("hex"), s) || egal(h(kò).digest("base64"), s);
}

export async function POST(req) {
  const kò = await req.text();
  if (!siyatiBon(kò, req.headers.get("x-moncashconnect-signature"), process.env.MONCASH_WEBHOOK_SECRET)) {
    console.error("moncash webhook: bad signature", req.headers.get("x-moncashconnect-signature")?.slice(0, 20));
    return json({ ere: "siyati" }, 401);
  }
  let ev;
  try {
    ev = JSON.parse(kò);
  } catch {
    return json({ ere: "json" }, 400);
  }
  console.log("moncash webhook", ev.type, ev.data?.orderId);
  if (ev.type !== "payment.completed") return json({ ok: true });

  const { orderId, amount, transactionId } = ev.data ?? {};
  const o = typeof orderId === "string" && /^AT-[\w-]{1,40}$/.test(orderId) ? await li(`moncash/${orderId}.json`) : null;
  if (!o) return json({ ok: true, inkoni: true });
  const e = await li(`enskripsyon/${o.id}.json`);
  if (!e) return json({ ok: true, inkoni: true });
  if (e.estati === "aksepte") return json({ ok: true });   // already done (webhooks can repeat)
  if (amount !== undefined && Number(amount) < o.montan) {
    console.error("moncash webhook: amount too low", orderId, amount, o.montan);
    e.moncash_pwoblem = `Montan ${amount} pi piti pase ${o.montan}`;
    await ekri(`enskripsyon/${e.id}.json`, e);
    return json({ ok: true });
  }
  await aksepte(e, { peman: "moncash", moncash_tranzaksyon: String(transactionId ?? ""), moncash_montan: Number(amount ?? o.montan) });
  return json({ ok: true });
}
