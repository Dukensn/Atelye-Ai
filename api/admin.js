import { randomBytes } from "node:crypto";
import {
  KONTNI_DEFO, efase, ekri, json, kontni, li, lis, netwaye, seAdmin, telefonWhatsApp,
} from "../lib/store.js";

const lyenEspas = (req, token) => `${new URL(req.url).origin}/espas?k=${token}`;

function mesajWhatsApp(e, lyen, kominote) {
  const premye = e.non.split(" ")[0];
  const tèks =
    `Bonjou ${premye}! Nou resevwa peman w lan pou Atelier AI. Men lyen espas ou: ${lyen}\nPa pataje l ak pèsonn, se pa w sèlman li ye.` +
    (kominote ? `\n\nRejwenn kominote WhatsApp la tou, se la w ap jwenn enfòmasyon ak akonpayman: ${kominote}` : "");
  return `https://wa.me/${telefonWhatsApp(e.telefon)}?text=${encodeURIComponent(tèks)}`;
}

export async function GET(req) {
  if (!seAdmin(req)) return json({ ere: "Modpas la pa bon." }, 401);
  const [tout, k] = await Promise.all([Promise.all((await lis("enskripsyon/")).map(li)), kontni()]);
  const lisFinal = tout
    .filter(Boolean)
    .sort((a, b) => b.kreye.localeCompare(a.kreye))
    .map((e) => ({
      ...e,
      lyen: e.token ? lyenEspas(req, e.token) : null,
      whatsapp: e.token ? mesajWhatsApp(e, lyenEspas(req, e.token), k.lyen_kominote) : null,
    }));
  return json({ lis: lisFinal, kontni: k });
}

export async function POST(req) {
  if (!seAdmin(req)) return json({ ere: "Modpas la pa bon." }, 401);
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Done yo pa bon." }, 400);
  }

  if (b.aksyon === "kontni") {
    const k = b.kontni ?? {};
    const url = (v) => {
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
      lyen_kominote: url(k.lyen_kominote),
      mesaj: netwaye(k.mesaj, 1000),
    };
    if ([nouvo.lyen_claude, nouvo.lyen_zouti, nouvo.lyen_gid, nouvo.lyen_kominote, ...videyo.map((v) => v.url)].some((x) => x === null))
      return json({ ere: "Chak lyen dwe kòmanse ak https://" }, 400);
    await ekri("kontni.json", nouvo);
    return json({ ok: true, kontni: nouvo });
  }

  const id = netwaye(b.id, 40);
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ ere: "Demann sa a pa egziste." }, 404);
  const e = await li(`enskripsyon/${id}.json`);
  if (!e) return json({ ere: "Demann sa a pa egziste." }, 404);

  if (b.aksyon === "aksepte") {
    if (!e.token) {
      e.token = randomBytes(24).toString("base64url");
      await ekri(`token/${e.token}.json`, { id: e.id });
    }
    e.estati = "aksepte";
    e.dat_desizyon = new Date().toISOString();
    await ekri(`enskripsyon/${e.id}.json`, e);
    const lyen = lyenEspas(req, e.token);
    return json({ ok: true, lyen, whatsapp: mesajWhatsApp(e, lyen, (await kontni()).lyen_kominote) });
  }

  if (b.aksyon === "refize") {
    if (e.token) await efase(`token/${e.token}.json`);
    e.estati = "refize";
    delete e.token;
    e.dat_desizyon = new Date().toISOString();
    await ekri(`enskripsyon/${e.id}.json`, e);
    return json({ ok: true });
  }

  return json({ ere: "Aksyon sa a pa egziste." }, 400);
}
