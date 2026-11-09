import { reponn, rpc, sv, voyeWa } from "../lib/wa.js";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Team actions from /staf (WhatsApp tab): reply to a customer, try the assistant, check the connection.
export async function POST(req) {
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
