import { ekri, ekriFoto, json, li, liFoto, netwaye, paramet, seAdmin } from "../lib/store.js";

const MAX = 3 * 1024 * 1024;
const idBon = (id) => /^[0-9a-f-]{36}$/.test(id);

// Step 2: the student sends a photo of the payment (already shrunk to JPEG in the browser).
export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return json({ ere: "Foto a twò gwo oswa li pa bon." }, 400);
  }
  const id = netwaye(b.id, 40);
  if (!idBon(id)) return json({ ere: "Rekòmanse enskripsyon an." }, 404);
  const e = await li(`enskripsyon/${id}.json`);
  if (!e) return json({ ere: "Rekòmanse enskripsyon an." }, 404);
  if (e.estati === "aksepte") return json({ ok: true });
  const p = await paramet();
  if (!p.manyel && p.moncash && process.env.MONCASH_SECRET_KEY) return json({ ere: "Peye ak MonCash pou w jwenn aksè ou touswit." }, 403);

  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.foto ?? ""));
  if (!m) return json({ ere: "Chwazi yon foto." }, 400);
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 1000 || buf.length > MAX || buf[0] !== 0xff || buf[1] !== 0xd8)
    return json({ ere: "Foto a pa bon. Eseye yon lòt." }, 400);

  await ekriFoto(`prev/${id}.jpg`, buf);
  e.foto = true;
  e.estati = "atann";
  e.prev_le = new Date().toISOString();
  await ekri(`enskripsyon/${id}.json`, e);
  return json({ ok: true });
}

// Admin only: show the proof photo.
export async function GET(req) {
  if (!seAdmin(req)) return json({ ere: "Modpas la pa bon." }, 401);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!idBon(id)) return json({ ere: "Pa jwenn foto a." }, 404);
  const buf = await liFoto(`prev/${id}.jpg`);
  if (!buf) return json({ ere: "Pa jwenn foto a." }, 404);
  return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" } });
}
