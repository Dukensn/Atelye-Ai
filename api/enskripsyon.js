import { randomUUID } from "node:crypto";
import { ekri, json, netwaye } from "../lib/store.js";

export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  const non = netwaye(b.non, 80);
  const telefon = netwaye(b.telefon, 20);
  const imel = netwaye(b.imel, 120);
  const tranzaksyon = netwaye(b.tranzaksyon, 40);
  const metod = b.metod === "natcash" ? "natcash" : b.metod === "moncash" ? "moncash" : null;

  if (non.length < 2) return json({ ere: "Ekri non w." }, 400);
  if (telefon.replace(/\D/g, "").length < 8) return json({ ere: "Nimewo telefòn nan pa bon." }, 400);
  if (imel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(imel)) return json({ ere: "Imèl la pa bon." }, 400);
  if (!metod) return json({ ere: "Chwazi MonCash oswa NatCash." }, 400);
  if (tranzaksyon.length < 4) return json({ ere: "Ekri nimewo tranzaksyon an." }, 400);

  const e = {
    id: randomUUID(),
    non, telefon, imel, metod, tranzaksyon,
    kreye: new Date().toISOString(),
    estati: "atann",
  };
  await ekri(`enskripsyon/${e.id}.json`, e);
  return json({ id: e.id });
}
