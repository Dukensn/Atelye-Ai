import { randomUUID } from "node:crypto";
import { ekri, json, netwaye } from "../lib/store.js";

// Step 1: name + WhatsApp only. The payment proof comes in step 2 (api/prev.js).
export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  const non = netwaye(b.non, 80);
  const telefon = netwaye(b.telefon, 20);
  if (non.length < 2) return json({ ere: "Ekri non w." }, 400);
  if (telefon.replace(/\D/g, "").length < 8) return json({ ere: "Nimewo WhatsApp la pa bon." }, 400);

  const e = { id: randomUUID(), non, telefon, kreye: new Date().toISOString(), estati: "san_prev" };
  await ekri(`enskripsyon/${e.id}.json`, e);
  return json({ id: e.id });
}
