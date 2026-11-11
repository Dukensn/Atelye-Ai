// WhatsApp sales assistant: Supabase (server functions with WA_SEKRE), the WhatsApp Cloud API, and Gemini.
import { createHmac, timingSafeEqual } from "node:crypto";
import { PEMAN } from "./store.js";

const SB_URL = "https://mfxyzjelxpziptlshkfv.supabase.co";
const SB_KLE = "sb_publishable_b1ed3iovvTdxVm0fyZ4FBw_PN8CrRlS";
const GRAPH = "https://graph.facebook.com/v22.0";
const SIT = "https://atelye-ai.vercel.app";

export async function rpc(fn, args = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KLE, "content-type": "application/json" }, body: JSON.stringify(args) });
  const t = await r.text();
  const d = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error((d && (d.message || d.hint)) || `rpc ${fn} ${r.status}`);
  return d;
}
export const sv = (fn, args = {}) => rpc(fn, { p_sekre: process.env.WA_SEKRE || "", ...args });

// X-Hub-Signature-256: "sha256=" + HMAC-SHA256(app secret, raw body)
export function siyatiMeta(ko, siyati, sekre) {
  if (!ko || !sekre || !/^sha256=[a-f0-9]{64}$/i.test(siyati || "")) return false;
  const a = Buffer.from(createHmac("sha256", sekre).update(ko).digest("hex")), b = Buffer.from(siyati.slice(7).toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function voyeWa(k, to, teks) {
  const r = await fetch(`${GRAPH}/${k.wa_phone_id}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${k.wa_token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: teks.slice(0, 4000), preview_url: true } }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || `WhatsApp ${r.status}`);
  return d.messages?.[0]?.id || null;
}

// photo or voice note sent by the customer: { mime, b64 } (null if too big or unavailable)
export async function telechaje(k, mediaId) {
  const m = await fetch(`${GRAPH}/${mediaId}`, { headers: { authorization: `Bearer ${k.wa_token}` } }).then((r) => r.json());
  if (!m.url || (m.file_size && m.file_size > 1_000_000)) return null;
  const buf = Buffer.from(await (await fetch(m.url, { headers: { authorization: `Bearer ${k.wa_token}` } })).arrayBuffer());
  return buf.length > 1_000_000 ? null : { mime: (m.mime_type || "").split(";")[0], b64: buf.toString("base64") };
}

const goud = (n) => Number(n).toLocaleString("fr-FR") + " goud";
const datKreyol = (iso) => iso ? new Intl.DateTimeFormat("fr-HT", { timeZone: "America/Port-au-Prince", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";

export function enstriksyon(k, konv) {
  const e = k.evenement || {};
  const tike = (e.types || []).map((t) => `- ${t.nom}: ${goud(t.prix_htg)}${t.prix_usd ? ` (${t.prix_usd} $)` : ""}, ${t.restants} plas ki rete` +
    (t.bloke ? `, POKO DISPONIB (l ap louvri lè tikè ki pi bon mache a fini${t.ouvre_le ? `, pa pita pase ${datKreyol(t.ouvre_le)}` : ""})` : "") +
    (t.date_fin_vente ? `, pri sa a fini ${datKreyol(t.date_fin_vente)}` : "")).join("\n") || "- (pa gen tikè disponib kounye a)";
  return `Ou se asistan WhatsApp Atelye AI (yon asistan AI). Ou pale kreyòl ayisyen natirèl; si moun nan ekri an franse oswa an anglè, reponn nan lang pa l.
Travay ou: reponn kesyon sou atelye a epi ede moun rezève plas yo epi peye, rapid e ak respè.

ENFÒMASYON VRE (pa janm envante lòt bagay):
- Evènman: ${e.nom || "Atelye konferans Atelye AI"}
- Dat: ${datKreyol(e.date)} (akèy depi 9h30, fini vè 4h00 apremidi)
- Kote: ${[e.lieu, e.adresse].filter(Boolean).join(", ")}
- Sa n ap aprann: kreye videyo ak AI (Claude, Higgsfield), piblisite Facebook (Facebook Ads, jenere prospè), kreye ak vann pwodwi dijital, otomatize vant (WhatsApp, Claude), epi rechaje kat pou peye zouti yo ak MonCash/NatCash. Telefòn ase, pa bezwen òdinatè.
- Bonis: 7 jou Claude Pro gratis pou 100 premye yo + zouti ak skill Atelye AI.
- Tikè (pri ak plas an tan reyèl):
${tike}
- Peman: MonCash ${PEMAN.moncash} oswa NatCash ${PEMAN.natcash}, non benefisyè: ${PEMAN.benefisye}. Montan an dwe egzak.
- Paj atelye a: ${SIT}/konferans

KI JAN POU W VANN:
1. Reponn kesyon an kout. Montre valè atelye a san egzajere.
2. Lè moun nan vle rezève: mande non konplè l (si w pa genyen l) epi si l ap peye ak MonCash oswa NatCash.
3. Rele zouti rezeve_tike. Apre sa, ba li kòd rezèvasyon an (AT-xxxx), montan egzak la ak nimewo pou l voye lajan an.
4. Lè l fin peye, mande l voye yon kapti ekran (foto) mesaj konfimasyon MonCash/NatCash la. Pa mande nimewo tranzaksyon. Lè w resevwa foto a, rele anrejistre_peman.
5. Di l ekip la ap verifye peman an epi l ap resevwa tikè a (ak kòd QR) sou WhatsApp. Pa di tikè a valide si se pa sa.

RÈG:
- Pa janm envante pri, rabè, dat oswa pwomès. Pa negosye pri a.
- Mesaj kout (2 a 5 liy), cho, klè; yon ou de emoji maksimòm.
- Si moun nan fache, mande ranbousman, gen yon pwoblèm peman, oswa w pa konnen repons lan: rele pase_bay_moun epi di l yon moun nan ekip la ap reponn li byento.
- Si yo mande si w se yon moun: di onètman ou se asistan AI Atelye AI, epi yon moun ka pran relè si yo vle.
${k.enstriksyon ? `\nENSTRIKSYON EKIP LA:\n${k.enstriksyon}\n` : ""}${baz(k)}
ETA KONVÈSASYON AN: ${JSON.stringify(konv || {})}`;
}

const baz = (k) => { const L = (k.konesans || []).filter((b) => b.pou !== "ekip"); return L.length ? `\nBAZ KONESANS (enfòmasyon vre ekip la ajoute):\n${L.map((b) => `### ${b.tit}\n${b.kontni}`).join("\n\n")}\n` : ""; };

const ZOUTI = [{ functionDeclarations: [
  { name: "rezeve_tike", description: "Kreye rezèvasyon an pou moun k ap ekri a (nimewo WhatsApp li). Retounen kòd la ak montan an.",
    parameters: { type: "object", properties: { non: { type: "string", description: "Non konplè moun nan" }, tip: { type: "string", description: "Non tikè a (egz. Lève-bonè). Vid = pi bon mache ki disponib." },
      moyen: { type: "string", enum: ["moncash", "natcash"] } }, required: ["non", "moyen"] } },
  { name: "anrejistre_peman", description: "Anrejistre prèv peman an (kapti ekran moun nan voye a) pou ekip la verifye l.",
    parameters: { type: "object", properties: { referans: { type: "string", description: "Kite vid. Mete nimewo tranzaksyon an sèlman si moun nan ekri l san foto." } } } },
  { name: "pase_bay_moun", description: "Pase konvèsasyon an bay yon moun nan ekip la (asistan an ap rete trankil).",
    parameters: { type: "object", properties: { rezon: { type: "string" } }, required: ["rezon"] } }] }];

// one answer from Gemini, running the tools it asks for; aksyon(name, args) does the real work (or a dry run in tests)
export async function reponn(k, { istwa, konv, medya, aksyon }) {
  const contents = [];
  for (const m of istwa) {
    const role = m.sans === "in" ? "user" : "model", text = m.sans === "staf" ? `[Ekip la] ${m.teks}` : m.teks || "";
    const dènye = contents[contents.length - 1];
    if (dènye && dènye.role === role) dènye.parts.push({ text }); else contents.push({ role, parts: [{ text }] });
  }
  if (!contents.length || contents[contents.length - 1].role !== "user") contents.push({ role: "user", parts: [{ text: "(mesaj vid)" }] });
  if (medya) contents[contents.length - 1].parts.push({ inlineData: { mimeType: medya.mime, data: medya.b64 } });
  const fe = [];
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(k.gemini_model || "gemini-3.8-flash")}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": k.gemini_kle, "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: enstriksyon(k, konv) }] }, contents, tools: ZOUTI, generationConfig: { temperature: 0.4, maxOutputTokens: 800 } }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Gemini: ${d.error?.message || r.status}`);
    const c = d.candidates?.[0]?.content;
    if (!c?.parts?.length) throw new Error("Gemini: pa gen repons");
    contents.push(c);
    const apel = c.parts.filter((p) => p.functionCall);
    if (!apel.length) return { teks: c.parts.map((p) => p.text || "").join("").trim(), fe };
    const rep = [];
    for (const p of apel) {
      let res;
      try { res = await aksyon(p.functionCall.name, p.functionCall.args || {}); } catch (er) { res = { ere: er.message }; }
      fe.push({ zouti: p.functionCall.name, res });
      rep.push({ functionResponse: { name: p.functionCall.name, response: res } });
    }
    contents.push({ role: "user", parts: rep });
  }
  throw new Error("Gemini: twòp etap");
}
