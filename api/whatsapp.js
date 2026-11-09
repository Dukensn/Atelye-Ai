import { waitUntil } from "@vercel/functions";
import { reponn, rpc, siyatiMeta, sv, telechaje, voyeWa } from "../lib/wa.js";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Meta checks the webhook URL once: echo hub.challenge when the verify token matches.
export async function GET(req) {
  const u = new URL(req.url);
  const k = await sv("wa_sv_konfig").catch(() => null);
  if (k && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === k.verify_token)
    return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
  return new Response("non", { status: 403 });
}

export async function POST(req) {
  if (new URL(req.url).searchParams.has("ekip")) return ekip(req);
  const ko = await req.text();
  let k;
  try { k = await sv("wa_sv_konfig"); } catch (er) { console.error("whatsapp: konfig", er.message); return new Response("konfig", { status: 500 }); }
  if (!siyatiMeta(ko, req.headers.get("x-hub-signature-256"), k.app_secret)) { console.error("whatsapp: bad signature"); return new Response("siyati", { status: 401 }); }
  let b;
  try { b = JSON.parse(ko); } catch { return new Response("json", { status: 400 }); }
  // answer Meta at once; the assistant keeps working after the response
  waitUntil(trete(k, b).catch((er) => console.error("whatsapp:", er.message)));
  return new Response("ok", { status: 200 });
}

function teksMesaj(m) {
  switch (m.type) {
    case "text": return m.text?.body || "";
    case "image": return m.image?.caption ? `[Foto] ${m.image.caption}` : "[Foto]";
    case "audio": return "[Mesaj vokal]";
    case "button": return m.button?.text || "";
    case "interactive": return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
    default: return `[${m.type}]`;
  }
}

async function trete(k, b) {
  for (const en of b.entry || []) for (const ch of en.changes || []) {
    const v = ch.value || {};
    // a team member wrote from the WhatsApp Business app (same number): the assistant stays quiet 24 h
    if (ch.field === "smb_message_echoes") {
      for (const e of v.message_echoes || []) await sv("wa_sv_ekri", { p_tel: e.to, p_sans: "staf", p_teks: e.text?.body || `[${e.type}]`, p_wa_id: e.id });
      continue;
    }
    if (ch.field !== "messages") continue;
    for (const m of v.messages || []) await yonMesaj(k, m, (v.contacts || []).find((c) => c.wa_id === m.from)?.profile?.name);
  }
}

async function yonMesaj(k, m, non) {
  const tel = m.from;
  let medya = null;
  if ((m.type === "image" || m.type === "audio") && k.wa_token) medya = await telechaje(k, m[m.type].id).catch(() => null);
  const r = await sv("wa_sv_resevwa", { p_tel: tel, p_non: non || null, p_wa_id: m.id, p_teks: teksMesaj(m),
    p_foto: medya && medya.mime === "image/jpeg" ? medya.b64 : null });
  if (r.dub || !k.aktif || !k.wa_token || !k.wa_phone_id) return;
  const di = async (teks) => { const id = await voyeWa(k, tel, teks); await sv("wa_sv_ekri", { p_tel: tel, p_sans: "bot", p_teks: teks, p_wa_id: id }); };
  if (r.relais) { await di("Mèsi pou mesaj ou. Yon moun nan ekip Atelye AI ap reponn ou byento. 🙏"); return; }
  if (!r.reponn || !k.gemini_kle) return;
  try {
    const rep = await reponn(k, { istwa: r.istwa, konv: r.konv, medya, aksyon: async (zouti, a) => {
      if (zouti === "rezeve_tike") return sv("wa_sv_rezeve", { p_tel: tel, p_non: a.non || non || "", p_tip: a.tip || "", p_moyen: a.moyen || "moncash" });
      if (zouti === "anrejistre_peman") return sv("wa_sv_peman", { p_tel: tel, p_referans: a.referans || "" });
      if (zouti === "pase_bay_moun") return sv("wa_sv_relais", { p_tel: tel, p_rezon: a.rezon || "" });
      return { ere: "zouti inkoni" };
    } });
    if (rep.teks) await di(rep.teks);
  } catch (er) {
    console.error("whatsapp: asistan", er.message);
    await sv("wa_sv_relais", { p_tel: tel, p_rezon: "Asistan an pa t ka reponn: " + er.message.slice(0, 120) }).catch(() => {});
  }
}

// Team actions from /staf (WhatsApp tab), on ?ekip=1: reply to a customer, try the assistant, check the connection.
async function ekip(req) {
  let b;
  try { b = await req.json(); } catch { return json({ ere: "Demann lan pa bon." }, 400); }
  try { await rpc("staf_wa_konfig", { p_code: b.kod || "" }); } catch (er) { return json({ ere: er.message }, 403); }
  let k;
  try { k = await sv("wa_sv_konfig"); } catch { return json({ ere: "Sèvè a poko konfigire (WA_SEKRE)." }, 500); }
  try {
    if (b.aksyon === "voye") {
      const teks = String(b.teks || "").trim(), tel = String(b.tel || "").replace(/\D/g, "");
      if (!teks || !tel) return json({ ere: "Ekri mesaj la." }, 400);
      if (!k.wa_token || !k.wa_phone_id) return json({ ere: "WhatsApp poko konekte." }, 400);
      const id = await voyeWa(k, tel, teks);
      await sv("wa_sv_ekri", { p_tel: tel, p_sans: "staf", p_teks: teks, p_wa_id: id });
      return json({ ok: true });
    }
    if (b.aksyon === "eseye") {
      if (!k.gemini_kle) return json({ ere: "Mete kle Gemini an anvan." }, 400);
      const istwa = (Array.isArray(b.istwa) ? b.istwa : []).slice(-20).map((m) => ({ sans: m.sans === "in" ? "in" : "bot", teks: String(m.teks || "").slice(0, 2000) }));
      const t0 = (k.evenement?.types || []).find((t) => !t.bloke);
      const rep = await reponn(k, { istwa, konv: { non: null, enskripsyon: null }, aksyon: async (zouti, a) => {
        if (zouti === "rezeve_tike") return { ok: true, tes: true, enskripsyon: { code_court: "AT-0000", statut: "en_attente", montant: t0?.prix_htg, moyen: a.moyen, tip: t0?.nom } };
        if (zouti === "anrejistre_peman") return { ok: true, tes: true };
        return { ok: true, tes: true };
      } });
      return json(rep);
    }
    if (b.aksyon === "tcheke") {
      if (!k.wa_token || !k.wa_phone_id) return json({ ok: false, ere: "Token oswa Phone number ID manke." });
      const r = await fetch(`https://graph.facebook.com/v22.0/${k.wa_phone_id}?fields=display_phone_number,verified_name,quality_rating`, { headers: { authorization: `Bearer ${k.wa_token}` } });
      const d = await r.json().catch(() => ({}));
      return r.ok ? json({ ok: true, nimewo: d.display_phone_number, non: d.verified_name, kalite: d.quality_rating }) : json({ ok: false, ere: d.error?.message || "Meta refize." });
    }
    return json({ ere: "Aksyon inkoni." }, 400);
  } catch (er) { return json({ ere: er.message }, 500); }
}
