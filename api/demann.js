import { ekri, json, kontni, toutEnskripsyon } from "../lib/store.js";
import { eleve, konteDemann } from "./espas.js";

// A student asks for an upcoming course to open (once per course; asking again withdraws it).
export async function POST(req) {
  const e = await eleve(req);
  if (!e) return json({ ere: "Rekonekte w." }, 401);
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }
  const m = (await kontni()).moduls.find((x) => x.id === b.kou);
  if (!m || m.estati !== "byento") return json({ ere: "Kou sa a pa egziste." }, 400);
  const d = new Set(e.demann ?? []);
  if (d.has(m.id)) d.delete(m.id); else d.add(m.id);
  e.demann = [...d];
  await ekri(`enskripsyon/${e.id}.json`, e);
  return json({ ok: true, demann: e.demann, demannKonte: konteDemann((await toutEnskripsyon()).map((x) => (x.id === e.id ? e : x))) });
}
