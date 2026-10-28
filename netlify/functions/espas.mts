import type { Config } from "@netlify/functions";
import { json, kontni, store, type Enskripsyon } from "../lib/store.mts";

export default async (req: Request) => {
  const k = (req.headers.get("x-kle") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(k)) return json({ ere: "kle" }, 401);
  const s = store();
  const t = (await s.get(`token/${k}`, { type: "json" })) as { id: string } | null;
  if (!t) return json({ ere: "kle" }, 401);
  const e = (await s.get(`enskripsyon/${t.id}`, { type: "json" })) as Enskripsyon | null;
  if (!e || e.estati !== "aksepte" || e.token !== k) return json({ ere: "kle" }, 401);
  return json({ non: e.non.split(" ")[0], kontni: await kontni() });
};

export const config: Config = {
  path: "/api/espas",
  method: "GET",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 30 },
};
