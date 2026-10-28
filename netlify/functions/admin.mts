import type { Config, Context } from "@netlify/functions";
import { randomBytes } from "node:crypto";
import {
  KONTNI_DEFO, json, kontni, netwaye, seAdmin, store, telefonWhatsApp,
  type Enskripsyon, type Kontni,
} from "../lib/store.mts";

const lyenEspas = (ctx: Context, token: string) => `${ctx.site.url}/espas?k=${token}`;

function mesajWhatsApp(e: Enskripsyon, lyen: string) {
  const premye = e.non.split(" ")[0];
  return `https://wa.me/${telefonWhatsApp(e.telefon)}?text=${encodeURIComponent(
    `Bonjou ${premye}! Nou resevwa peman w lan pou Atelier AI. Men lyen espas ou: ${lyen}\nPa pataje l ak pèsonn, se pa w sèlman li ye.`,
  )}`;
}

export default async (req: Request, ctx: Context) => {
  if (!seAdmin(req)) return json({ ere: "Modpas la pa bon." }, 401);
  const s = store();

  if (req.method === "GET") {
    const { blobs } = await s.list({ prefix: "enskripsyon/" });
    const tout = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))) as Enskripsyon[];
    const lis = tout
      .filter(Boolean)
      .sort((a, b) => b.kreye.localeCompare(a.kreye))
      .map((e) => ({
        ...e,
        lyen: e.token ? lyenEspas(ctx, e.token) : null,
        whatsapp: e.token ? mesajWhatsApp(e, lyenEspas(ctx, e.token)) : null,
      }));
    return json({ lis, kontni: await kontni() });
  }

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }

  if (b.aksyon === "kontni") {
    const k = (b.kontni ?? {}) as Partial<Kontni>;
    const url = (v: unknown) => {
      const x = netwaye(v, 500);
      return x === "" || /^https:\/\//.test(x) ? x : null;
    };
    const videyo = (Array.isArray(k.videyo) ? k.videyo : KONTNI_DEFO.videyo).slice(0, 6).map((v) => ({
      tit: netwaye(v?.tit, 120),
      url: url(v?.url),
    }));
    const nouvo = {
      videyo,
      lyen_claude: url(k.lyen_claude),
      lyen_zouti: url(k.lyen_zouti),
      lyen_gid: url(k.lyen_gid),
      mesaj: netwaye(k.mesaj, 1000),
    };
    if ([nouvo.lyen_claude, nouvo.lyen_zouti, nouvo.lyen_gid, ...videyo.map((v) => v.url)].some((x) => x === null))
      return json({ ere: "Chak lyen dwe kòmanse ak https://" }, 400);
    await s.setJSON("kontni", nouvo);
    return json({ ok: true, kontni: nouvo });
  }

  const id = netwaye(b.id, 40);
  const e = (await s.get(`enskripsyon/${id}`, { type: "json" })) as Enskripsyon | null;
  if (!e) return json({ ere: "Demann sa a pa egziste." }, 404);

  if (b.aksyon === "aksepte") {
    if (!e.token) {
      e.token = randomBytes(24).toString("base64url");
      await s.setJSON(`token/${e.token}`, { id: e.id });
    }
    e.estati = "aksepte";
    e.dat_desizyon = new Date().toISOString();
    await s.setJSON(`enskripsyon/${e.id}`, e);
    const lyen = lyenEspas(ctx, e.token);
    return json({ ok: true, lyen, whatsapp: mesajWhatsApp(e, lyen) });
  }

  if (b.aksyon === "refize") {
    if (e.token) await s.delete(`token/${e.token}`);
    e.estati = "refize";
    e.token = undefined;
    e.dat_desizyon = new Date().toISOString();
    await s.setJSON(`enskripsyon/${e.id}`, e);
    return json({ ok: true });
  }

  return json({ ere: "Aksyon sa a pa egziste." }, 400);
};

export const config: Config = {
  path: "/api/admin",
  method: ["GET", "POST"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 30 },
};
