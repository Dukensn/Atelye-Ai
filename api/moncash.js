import { randomBytes } from "node:crypto";
import { ekri, json, li, netwaye, paramet } from "../lib/store.js";

// Online payment with MonCash through MonCashConnect: the server creates a payment session with the
// secret key (never sent to the browser) and the phone is redirected to MonCash to confirm with its PIN.
// The space opens when the webhook (api/moncash-webhook.js) confirms the payment.
const API = process.env.MONCASH_API_URL || "https://api.moncashconnect.com/v1/pay-create";

export async function POST(req) {
  const kle = process.env.MONCASH_SECRET_KEY;
  const p = await paramet();
  if (!kle || !p.moncash) return json({ ere: "Peman MonCash pa disponib kounye a. Peye alamen." }, 503);
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  const id = netwaye(b.id, 40);
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ ere: "Rekòmanse enskripsyon an." }, 404);
  const e = await li(`enskripsyon/${id}.json`);
  if (!e) return json({ ere: "Rekòmanse enskripsyon an." }, 404);
  if (e.estati === "aksepte") return json({ deja: true });

  // A fresh order id per attempt, mapped back to the registration for the webhook.
  const orderId = `AT-${id.slice(0, 8)}-${randomBytes(4).toString("hex")}`;
  const orijin = new URL(req.url).origin;
  let d;
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${kle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: p.pri,
        orderId,
        description: "Fòmasyon Atelye AI",
        returnUrl: `${orijin}/peye?mc=ok`,
        cancelUrl: `${orijin}/peye?mc=anile`,
      }),
    });
    d = await r.json().catch(() => ({}));
    if (!r.ok || !d.paymentUrl) {
      console.error("moncash pay-create", r.status, JSON.stringify(d).slice(0, 300));
      return json({ ere: "MonCash pa reponn kounye a. Eseye ankò oswa peye alamen." }, 502);
    }
  } catch (err) {
    console.error("moncash pay-create", String(err));
    return json({ ere: "MonCash pa reponn kounye a. Eseye ankò oswa peye alamen." }, 502);
  }
  await ekri(`moncash/${orderId}.json`, { id, montan: p.pri, kreye: new Date().toISOString() });
  e.moncash_order = orderId;
  await ekri(`enskripsyon/${id}.json`, e);
  return json({ paymentUrl: d.paymentUrl });
}
