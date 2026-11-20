// Team resources (videos, PDFs, any file) kept in the public Blob store "atelye-resous".
// Uploads go straight from the browser to Blob (no size limit from our functions); this file only
// checks the team member, hands out upload tokens, lists and deletes. Download links are public.
import { del, list } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import { rpc } from "./wa.js";

const TOKEN = () => process.env.RESOUS_READ_WRITE_TOKEN;
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// only members who manage the team (admins) may add or remove resources
async function admin(kod) {
  if (!kod) throw new Error("Konekte anvan.");
  await rpc("staf_ekip", { p_code: kod });
}

export async function resous(req) {
  if (!TOKEN()) return json({ ere: "Estokaj resous la poko konekte (RESOUS_READ_WRITE_TOKEN)." }, 500);
  const b = await req.json().catch(() => ({}));
  // the Blob client asks for an upload token, then reports the finished upload
  if (b.type === "blob.generate-client-token" || b.type === "blob.upload-completed") {
    try {
      const r = await handleUpload({
        body: b, request: req, token: TOKEN(),
        onBeforeGenerateToken: async (chemen, payload) => {
          await admin(JSON.parse(payload || "{}").kod);
          if (!chemen.startsWith("resous/")) throw new Error("Chemen an pa bon.");
          return { maximumSizeInBytes: 2 * 1024 ** 3, addRandomSuffix: true };
        },
        onUploadCompleted: async () => {},
      });
      return json(r);
    } catch (er) { return json({ ere: er.message }, 400); }
  }
  try { await admin(b.kod); } catch (er) { return json({ ere: er.message }, 403); }
  if (b.aksyon === "lis") {
    const fichye = [];
    let cursor;
    do {
      const r = await list({ prefix: "resous/", cursor, limit: 1000, token: TOKEN() });
      fichye.push(...r.blobs.map((x) => ({ url: x.url, telechaje: x.downloadUrl, non: x.pathname.slice(7), gwosè: x.size, le: x.uploadedAt })));
      cursor = r.hasMore ? r.cursor : null;
    } while (cursor);
    fichye.sort((a, b) => String(b.le).localeCompare(String(a.le)));
    return json({ fichye });
  }
  if (b.aksyon === "efase") {
    if (!/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/resous\//.test(String(b.url || ""))) return json({ ere: "Lyen an pa bon." }, 400);
    await del(b.url, { token: TOKEN() });
    return json({ ok: true });
  }
  return json({ ere: "Aksyon inkoni." }, 400);
}
