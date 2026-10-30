import { randomBytes } from "node:crypto";
import { ekri, json, li, netwaye, paramet } from "../lib/store.js";

// Online payment through Kobara (MonCash or NatCash): the server creates a checkout for this student
// with the secret key (never sent to the browser), so the webhook (api/kobara-webhook.js) knows who paid
// and opens the space without a receipt photo.
const API = (process.env.KOBARA_API_URL || "https://api.kobara.app/v1").replace(/\/$/, "");

export async function POST(req) {
  const kle = process.env.KOBARA_SECRET_KEY;
  const p = await paramet();
  if (!kle || !process.env.KOBARA_WEBHOOK_SECRET || !p.otomatik) return json({ ere: "Peman otomatik la pa disponib kounye a." }, 503);
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

  // A fresh reference per attempt, mapped back to the registration for the webhook.
  const ref = `AT-${id.slice(0, 8)}-${randomBytes(4).toString("hex")}`;
  const orijin = new URL(req.url).origin;
  let d;
  try {
    const r = await fetch(`${API}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${kle}`, "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": ref },
      body: JSON.stringify({
        amount: p.pri,
        currency: "HTG",
        provider: "kobara",
        description: "Fòmasyon Atelye AI",
        customer: { name: e.non, phone: e.telefon },
        success_url: `${orijin}/peye?mc=ok&i=${id}`,
        cancel_url: `${orijin}/peye?mc=anile`,
        metadata: { ref, enskripsyon: id },
      }),
    });
    d = await r.json().catch(() => ({}));
    if (!r.ok || !d.data?.checkout_url) {
      console.error("kobara payments", r.status, JSON.stringify(d).slice(0, 300));
      return json({ ere: "Peman an pa louvri kounye a. Eseye ankò." }, 502);
    }
  } catch (err) {
    console.error("kobara payments", String(err));
    return json({ ere: "Peman an pa louvri kounye a. Eseye ankò." }, 502);
  }
  const kobaraId = d.data.id ?? d.data.payment_id ?? d.data.reference ?? null;
  await ekri(`kobara/${ref}.json`, { id, montan: p.pri, kobara_id: kobaraId, kreye: new Date().toISOString() });
  if (kobaraId && /^[\w-]{1,80}$/.test(String(kobaraId))) await ekri(`kobara-id/${kobaraId}.json`, { ref });
  e.kobara_ref = ref;
  await ekri(`enskripsyon/${id}.json`, e);
  return json({ url: d.data.checkout_url });
}
