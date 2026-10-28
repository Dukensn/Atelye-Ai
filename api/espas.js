import { json, kontni, li } from "../lib/store.js";

export async function GET(req) {
  const k = (req.headers.get("x-kle") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(k)) return json({ ere: "kle" }, 401);
  const t = await li(`token/${k}.json`);
  if (!t) return json({ ere: "kle" }, 401);
  const e = await li(`enskripsyon/${t.id}.json`);
  if (!e || e.estati !== "aksepte" || e.token !== k) return json({ ere: "kle" }, 401);
  return json({ non: e.non.split(" ")[0], kontni: await kontni() });
}
