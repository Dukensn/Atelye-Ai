// Team assistant (/staf → Asistan): Gemini with tools that act through the member's own session,
// so every action goes through the same database checks as the screens (a member can only do what their role allows).
import { rpc } from "./wa.js";

const TZ = "America/Port-au-Prince";
const nòm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const jwenn = (lis, non, kle = "non") => {
  const n = nòm(non); if (!n) return null;
  return lis.find((x) => nòm(x[kle]) === n) || lis.find((x) => nòm(x[kle]).startsWith(n)) || lis.find((x) => nòm(x[kle]).includes(n)) || null;
};
const jodi = () => new Intl.DateTimeFormat("fr-HT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
const datIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export const ZOUTI_AJAN = [{ functionDeclarations: [
  { name: "rapo", description: "Chif atelye a an tan reyèl: enskri, peye, lajan antre, peman pou verifye, plas ki rete pa tikè, enskripsyon pa jou, travay ekip la (an reta, pou jodi a).", parameters: { type: "object", properties: {} } },
  { name: "lis_enskripsyon", description: "Lis moun ki enskri yo (non, telefòn, kòd, tikè, estati). Itil pou relanse moun ki poko peye.",
    parameters: { type: "object", properties: { filt: { type: "string", enum: ["tout", "poko_peye", "ap_tann_verifikasyon", "valide", "refize"] }, limit: { type: "integer" } } } },
  { name: "analize_whatsapp", description: "Konvèsasyon WhatsApp kliyan yo ak mesaj yo pou analize kesyon yo poze, objeksyon, enterè, moun ki bezwen yon moun.",
    parameters: { type: "object", properties: { jou: { type: "integer", description: "Konbyen dènye jou (1-60), default 7" } } } },
  { name: "lis_travay", description: "Travay ekip la (ak pwojè/lis yo, moun ki gen yo, dat limit, si yo fini).",
    parameters: { type: "object", properties: { pou: { type: "string", enum: ["mwen", "tout"] }, pwoje: { type: "string", description: "Non pwojè a (si w vle yon sèl pwojè)" }, fini: { type: "boolean", description: "true = sèlman sa ki fini; false = sèlman sa ki rete" } } } },
  { name: "kreye_travay", description: "Kreye yon travay (oswa yon atik nan yon lis pwojè). Si lis la pa egziste nan pwojè a, li kreye l.",
    parameters: { type: "object", properties: { tit: { type: "string" }, moun: { type: "string", description: "Non manm ki dwe fè l" }, dat: { type: "string", description: "Dat limit YYYY-MM-DD" },
      pwoje: { type: "string" }, lis: { type: "string", description: "Tèm lis la nan pwojè a (egz. Lojistik, Depans)" }, montan: { type: "number", description: "Montan an goud (pou depans)" }, nota: { type: "string" } }, required: ["tit"] } },
  { name: "mete_ajou_travay", description: "Make yon travay fini (oswa pa fini), chanje moun nan oswa dat la. Bay id ki soti nan lis_travay.",
    parameters: { type: "object", properties: { id: { type: "string" }, fini: { type: "boolean" }, moun: { type: "string" }, dat: { type: "string" } }, required: ["id"] } },
  { name: "kreye_pwoje", description: "Kreye yon pwojè ak plizyè lis pa tèm (egz. Lojistik, Depans, Kominikasyon, Pwogram).",
    parameters: { type: "object", properties: { tit: { type: "string" }, deskripsyon: { type: "string" }, lis: { type: "array", items: { type: "string" } } }, required: ["tit"] } },
  { name: "voye_anons", description: "Pibliye yon anons/mesaj pou tout ekip la, pou yon wòl (gwoup) oswa pou yon sèl manm. Ak yon dat nan lavni, li pwograme l.",
    parameters: { type: "object", properties: { tit: { type: "string" }, kontni: { type: "string" }, pou: { type: "string", description: "'tout', non yon wòl (egz. Validatè) oswa non yon manm" },
      dat: { type: "string", description: "Lè pou l parèt, ISO ak lè Ayiti, egz. 2026-11-27T08:00:00-05:00. Vid = kounye a." }, epeng: { type: "boolean" } }, required: ["tit", "kontni"] } },
  { name: "ekri_dokiman", description: "Anrejistre yon dokiman pou ekip la (rapò, plan, lis, pwosè-vèbal). Kontni an an Markdown senp (#, -, **).",
    parameters: { type: "object", properties: { tit: { type: "string" }, kontni: { type: "string" } }, required: ["tit", "kontni"] } },
  { name: "li_dokiman", description: "Li yon dokiman ekip la pa tit li (oswa bay lis tit yo si tit la vid).", parameters: { type: "object", properties: { tit: { type: "string" } } } },
  { name: "ajoute_konesans", description: "Ajoute oswa korije yon fich nan baz konesans asistan yo (WhatsApp ak/oswa ekip).",
    parameters: { type: "object", properties: { tit: { type: "string" }, kontni: { type: "string" }, pou: { type: "string", enum: ["wa", "ekip", "tou_de"] } }, required: ["tit", "kontni"] } },
] }];

function sistèm(mwen, k) {
  const e = k.evenement || {};
  const baz = (k.konesans || []).filter((b) => b.pou !== "wa").map((b) => `### ${b.tit}\n${b.kontni}`).join("\n\n");
  return `Ou se asistan ekip Atelye AI (yon asistan AI nan espas ekip la). Ou ede ${mwen.non} (${mwen.role_non || mwen.role}${mwen.fonksyon ? ", " + mwen.fonksyon : ""}).
Jodi a: ${jodi()} (lè Ayiti, UTC-5). Dat ISO jodi a: ${datIso()}.
Evènman: ${e.nom || "Atelye konferans Atelye AI"}, ${e.date ? new Intl.DateTimeFormat("fr-HT", { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(new Date(e.date)) : ""}, ${[e.lieu, e.adresse].filter(Boolean).join(", ")}.
Aksè ${premye(mwen.non)}: ${(mwen.akse || []).join("; ") || "manm ekip"}.

KI JAN POU W TRAVAY:
- Pale nan lang moun nan (kreyòl ayisyen pa default, franse si l ekri an franse). Kout, klè, pratik.
- Pou chif, enskripsyon, travay, WhatsApp: rele zouti yo; pa janm envante chif. Si yon zouti di "pa gen aksè", di l senpleman.
- Rapò: tit kout, 3-6 pwen kle ak chif, epi 1-3 pwochen etap konkrè. Si yo mande l, anrejistre l ak ekri_dokiman.
- Analiz WhatsApp: kesyon ki pi souvan, objeksyon (pri, dat, kote…), moun ki montre enterè men ki poko peye, moun ki bezwen yon moun, epi sa pou amelyore nan repons asistan an oswa nan baz konesans lan.
- Pouse enterè: pwopoze mesaj relans kout, pèsonèl, san presyon (yon mesaj pa moun oswa yon modèl), ak lyen wa.me si w gen nimewo a.
- Anvan w pibliye yon anons pou lòt moun, montre bouyon an epi mande konfimasyon, SOF si moun nan te deja di klèman pou voye l.
- Pwograme: itilize voye_anons ak yon dat nan lavni (lè Ayiti, -05:00).
- Pa janm mete kle API, modpas oswa enfòmasyon prive nan yon anons.
- Fòma: Markdown senp (**gra**, lis ak -). Pa gen tablo.
${baz ? `\nBAZ KONESANS:\n${baz}\n` : ""}`;
}
const premye = (n) => String(n || "").split(" ")[0];

// one answer, running the tools Gemini asks for (each through the member's session)
export async function ajan(k, kod, istwa) {
  const mwen = await rpc("staf_mwen", { p_code: kod });
  let Z = null;
  const zouti = async () => (Z ||= await rpc("staf_zouti", { p_code: kod }));
  const nonManm = (id) => (Z?.manm || []).find((m) => m.id === id)?.non || null;
  const fè = {
    async rapo() {
      const t = await rpc("staf_tablo", { p_code: kod }); const z = await zouti(); const d = datIso();
      const ouvè = z.travay.filter((x) => !x.fini);
      return { evenman: t.evenement && { non: t.evenement.nom, dat: t.evenement.date, kapasite: t.evenement.capacite },
        chif: t.chif || "pa gen aksè chif", peman_pou_verifye: (t.file || []).length,
        tike: (t.types || []).map((x) => ({ non: x.nom, pri_goud: x.prix_htg, plas_ki_rete: x.restants, poko_disponib: x.bloke })),
        enskripsyon_pa_jou: (t.par_jour || []).slice(-14),
        travay: { ouvè: ouvè.length, an_reta: ouvè.filter((x) => x.dat && x.dat < d).length, pou_jodi: ouvè.filter((x) => x.dat === d).length, fini: z.travay.length - ouvè.length } };
    },
    async lis_enskripsyon(a) {
      const t = await rpc("staf_tablo", { p_code: kod });
      if (!t.lis || (!t.lis.length && !t.chif)) return { ere: "Ou pa gen aksè lis enskripsyon an." };
      const f = { poko_peye: (x) => x.statut === "en_attente" && !x.reference, ap_tann_verifikasyon: (x) => x.statut === "en_attente" && !!x.reference,
        valide: (x) => x.statut === "valide", refize: (x) => x.statut === "refuse" }[a.filt] || (() => true);
      const L = t.lis.filter(f);
      return { total: L.length, moun: L.slice(0, Math.min(a.limit || 60, 150)).map((x) => ({ non: x.nom, telefon: x.telephone, kod: x.code_court, tike: x.type, estati: x.statut, peye: !!x.reference, kreye: x.cree_le })) };
    },
    async analize_whatsapp(a) { return rpc("staf_wa_rezime", { p_code: kod, p_jou: a.jou || 7 }); },
    async lis_travay(a) {
      const z = await zouti(); const lis = Object.fromEntries(z.pwoje.flatMap((p) => p.lis.map((l) => [l.id, { pwoje: p.tit, lis: l.tit }])));
      let L = z.travay;
      if (a.pou === "mwen") L = L.filter((x) => x.moun === z.mwen);
      if (typeof a.fini === "boolean") L = L.filter((x) => x.fini === a.fini);
      if (a.pwoje) { const p = jwenn(z.pwoje, a.pwoje, "tit"); if (!p) return { ere: `Pa gen pwojè « ${a.pwoje} ».`, pwoje: z.pwoje.map((x) => x.tit) }; L = L.filter((x) => lis[x.lis_id]?.pwoje === p.tit); }
      return { total: L.length, travay: L.slice(0, 120).map((x) => ({ id: x.id, tit: x.tit, fini: x.fini, moun: nonManm(x.moun), dat: x.dat, montan: x.montan, ...(lis[x.lis_id] || {}) })) };
    },
    async kreye_travay(a) {
      const z = await zouti(); let lis_id = null, moun = null;
      if (a.moun) { const m = jwenn(z.manm, a.moun); if (!m) return { ere: `Pa gen manm « ${a.moun} ».`, manm: z.manm.map((x) => x.non) }; moun = m.id; }
      if (a.pwoje) {
        const p = jwenn(z.pwoje, a.pwoje, "tit"); if (!p) return { ere: `Pa gen pwojè « ${a.pwoje} ». Kreye l anvan ak kreye_pwoje.`, pwoje: z.pwoje.map((x) => x.tit) };
        let l = a.lis ? jwenn(p.lis, a.lis, "tit") : p.lis[0];
        if (!l) { const r = await rpc("staf_lis_mete", { p_code: kod, p: { pwoje_id: p.id, tit: a.lis || "Travay" } }); l = { id: r.id }; }
        lis_id = l.id;
      }
      const r = await rpc("staf_travay_mete", { p_code: kod, p: { tit: a.tit, moun, dat: a.dat || "", lis_id, montan: a.montan ?? "", nota: a.nota || "" } });
      Z = null; return { ok: true, id: r.id };
    },
    async mete_ajou_travay(a) {
      const p = { id: a.id };
      if (typeof a.fini === "boolean") p.fini = a.fini;
      if (a.dat) p.dat = a.dat;
      if (a.moun) { const z = await zouti(); const m = jwenn(z.manm, a.moun); if (!m) return { ere: `Pa gen manm « ${a.moun} ».` }; p.moun = m.id; }
      await rpc("staf_travay_mete", { p_code: kod, p }); Z = null; return { ok: true };
    },
    async kreye_pwoje(a) { const r = await rpc("staf_pwoje_mete", { p_code: kod, p: { tit: a.tit, deskripsyon: a.deskripsyon || "", lis: a.lis || [] } }); Z = null; return { ok: true, id: r.id }; },
    async voye_anons(a) {
      const z = await zouti(); let pou = "tout";
      if (a.pou && !["tout", "tout moun", "ekip la", "tout ekip la"].includes(nòm(a.pou))) {
        const w = jwenn(z.wol, a.pou), m = !w && jwenn(z.manm, a.pou);
        if (w) pou = "wol:" + w.kle; else if (m) pou = "moun:" + m.id;
        else return { ere: `Pa jwenn wòl oswa manm « ${a.pou} ».`, wol: z.wol.map((x) => x.non), manm: z.manm.map((x) => x.non) };
      }
      const r = await rpc("staf_anons_mete", { p_code: kod, p: { tit: a.tit, kontni: a.kontni, pou, pibliye_le: a.dat || "", epeng: !!a.epeng } });
      return { ok: true, pwograme: r.pwograme, pou };
    },
    async ekri_dokiman(a) { const r = await rpc("staf_dokiman_mete", { p_code: kod, p: { tit: a.tit, kontni: a.kontni } }); Z = null; return { ok: true, id: r.id }; },
    async li_dokiman(a) {
      const z = await zouti(); if (!a.tit) return { dokiman: z.dokiman.map((d) => d.tit) };
      const d = jwenn(z.dokiman, a.tit, "tit"); if (!d) return { ere: `Pa gen dokiman « ${a.tit} ».`, dokiman: z.dokiman.map((x) => x.tit) };
      const r = await rpc("staf_dokiman", { p_code: kod, p_id: d.id }); return { tit: r.tit, kontni: String(r.kontni).slice(0, 12000) };
    },
    async ajoute_konesans(a) {
      const L = await rpc("staf_konesans", { p_code: kod }); const b = jwenn(L, a.tit, "tit");
      const r = await rpc("staf_konesans_mete", { p_code: kod, p: { id: b && nòm(b.tit) === nòm(a.tit) ? b.id : "", tit: a.tit, kontni: a.kontni, pou: a.pou || "tou_de" } });
      return { ok: true, id: r.id };
    },
  };

  const contents = [];
  for (const m of istwa) {
    const role = m.sans === "in" ? "user" : "model", dènye = contents[contents.length - 1];
    if (dènye && dènye.role === role) dènye.parts.push({ text: m.teks }); else contents.push({ role, parts: [{ text: m.teks }] });
  }
  if (!contents.length || contents[contents.length - 1].role !== "user") throw new Error("Ekri yon mesaj.");
  const fe = [], system = sistèm(mwen, k);
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(k.gemini_model || "gemini-3.8-flash")}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": k.gemini_kle, "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools: ZOUTI_AJAN, generationConfig: { temperature: 0.3, maxOutputTokens: 2000 } }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Gemini: ${d.error?.message || r.status}`);
    const c = d.candidates?.[0]?.content;
    if (!c?.parts?.length) throw new Error("Gemini: pa gen repons");
    contents.push(c);
    const apel = c.parts.filter((p) => p.functionCall);
    if (!apel.length) return { teks: c.parts.map((p) => p.text || "").join("").trim(), fe };
    const rep = [];
    for (const p of apel) {
      const non = p.functionCall.name; let res;
      try { res = fè[non] ? await fè[non](p.functionCall.args || {}) : { ere: "zouti inkoni" }; } catch (er) { res = { ere: er.message }; }
      fe.push({ zouti: non, ok: !res?.ere });
      rep.push({ functionResponse: { name: non, response: res } });
    }
    contents.push({ role: "user", parts: rep });
  }
  throw new Error("Gemini: twòp etap");
}
