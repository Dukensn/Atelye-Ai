// WhatsApp assistant: the real webhook code against local Postgres; Meta (Graph) and Gemini are simulated.
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
const require = createRequire("/tmp/claude-0/-home-user/f3f252e9-ddde-5a6f-90c9-6cc21f0637e8/scratchpad/vend/node_modules/x.js");
const { Client } = require("pg");
const db = new Client({ host: "localhost", user: "postgres", password: "pw", database: "levve" });
await db.connect();
let q = Promise.resolve();
const rpc = (fn, args) => {
  const r = q.then(async () => {
    const ks = Object.keys(args);
    await db.query("begin"); await db.query("set local role anon");
    try {
      const x = await db.query(`select public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`, ks.map((k) => args[k] !== null && typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k]));
      await db.query("commit"); return [200, x.rows[0].r];
    } catch (e) { await db.query("rollback"); return [400, { message: e.message }]; }
  });
  q = r.catch(() => {}); return r;
};
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

const SEKRE_APP = "0123456789abcdef0123456789abcdef";
process.env.WA_SEKRE = "sekre-tes-wa";
await db.query("update wa_konfig set sekre_hash = encode(extensions.digest($1,'sha256'),'hex'), aktif = true, gemini_kle = 'AIzaFAKEKEY0000000000000000000000', wa_token = 'EAAGfake000000000000000000', wa_phone_id = '111', app_secret = $2, mo_relais = 'ranbou, pwoblèm'", [process.env.WA_SEKRE, SEKRE_APP]);
const T = String(Date.now()).slice(-4);           // fresh phone numbers each run
const t1 = "509444" + T + "1", t2 = "509444" + T + "2", t3 = "509444" + T + "3";

const sent = [], gem = [];
let plan = [];   // scripted Gemini answers
globalThis.fetch = async (url, o = {}) => {
  url = String(url);
  if (url.includes("/rest/v1/rpc/")) { const [st, b] = await rpc(url.split("/rpc/")[1], JSON.parse(o.body || "{}")); return new Response(JSON.stringify(b), { status: st }); }
  if (url.includes("graph.facebook.com") && url.endsWith("/messages")) { sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + T + sent.length }] })); }
  if (url.includes("generativelanguage")) { gem.push(JSON.parse(o.body)); const p = plan.shift(); return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [p] } }] })); }
  throw new Error("unexpected fetch " + url);
};
const { POST, GET } = await import("../../api/whatsapp.js");
const msg = (id, from, text) => JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { contacts: [{ wa_id: from, profile: { name: "Mari" } }], messages: [{ id: id + T, from, type: "text", text: { body: text } }] } }] }] });
const sig = (b) => "sha256=" + createHmac("sha256", SEKRE_APP).update(b).digest("hex");
const post = async (b, s = sig(b)) => POST(new Request("http://x/api/whatsapp", { method: "POST", body: b, headers: { "x-hub-signature-256": s } }));
const tann = async (f) => { for (let i = 0; i < 100; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
const poz = () => new Promise((r) => setTimeout(r, 300));

const vt = (await db.query("select verify_token from wa_konfig")).rows[0].verify_token;
ok(await (await GET(new Request(`http://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=${vt}&hub.challenge=4242`))).text() === "4242", "Meta webhook check answered");
ok((await GET(new Request("http://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=1"))).status === 403, "wrong verify token refused");
ok((await post(msg("w0", t1, "alo"), "sha256=" + "0".repeat(64))).status === 401, "forged message refused (signature)");

// 1) question -> answer with real prices
plan = [{ text: "Bonjou Mari! Lève-bonè a 2 000 goud." }];
ok((await post(msg("w1", t1, "Bonjou, konbyen tikè a ye?"))).status === 200, "message accepted");
ok(await tann(() => sent.length === 1), "assistant answered on WhatsApp");
ok(sent[0]?.to === t1 && sent[0]?.text.body.includes("2 000"), "answer sent to the customer");
const si = gem[0]?.systemInstruction.parts[0].text || "";
ok(si.includes("Lève-bonè") && si.includes("goud") && si.includes("3864 9724"), "assistant knows live ticket prices and payment number");
await post(msg("w1", t1, "Bonjou, konbyen tikè a ye?")); await poz();
ok(sent.length === 1, "same message delivered twice is answered once");

// 2) booking through the tool
plan = [{ functionCall: { name: "rezeve_tike", args: { non: "Mari Jozèf", tip: "Lève-bonè", moyen: "moncash" } } }, { text: "Rezèvasyon an fèt! Voye montan an sou MonCash." }];
await post(msg("w2", t1, "Mwen vle rezève, mwen se Mari Jozèf, MonCash"));
ok(await tann(() => sent.length === 2), "booking answer sent");
const ins = (await db.query("select i.code_court, i.statut, i.telephone_cle from wa_konv c join inscriptions i on i.id = c.inscription_id where c.telefon = $1", [t1])).rows[0];
ok(ins && ins.statut === "en_attente" && ins.telephone_cle === t1, "booking created in the ticket system: " + (ins && ins.code_court));
ok(JSON.stringify(gem.at(-1).contents).includes(ins?.code_court), "assistant received the booking code");

// 3) payment reference
plan = [{ functionCall: { name: "anrejistre_peman", args: { referans: "TX" + Date.now() } } }, { text: "Mèsi! Ekip la ap verifye." }];
await post(msg("w3", t1, "Mwen peye, men nimewo a"));
ok(await tann(() => sent.length === 3), "payment answer sent");
ok((await db.query("select reference_paiement from inscriptions i join wa_konv c on c.inscription_id = i.id where c.telefon = $1", [t1])).rows[0].reference_paiement?.startsWith("TX"), "payment reference waits in the team's payment queue");

// 4) a relay word: one polite message, then silence
await post(msg("w4", t1, "Mwen vle yon ranbou"));
ok(await tann(() => sent.length === 4), "relay message sent");
ok(sent[3]?.text.body.includes("ekip"), "customer told a person will answer");
const c = (await db.query("select eta, alet from wa_konv where telefon = $1", [t1])).rows[0];
ok(c.eta === "moun" && c.alet, "conversation flagged for a person");
const ng = gem.length;
await post(msg("w5", t1, "Alo?")); await poz();
ok(sent.length === 4 && gem.length === ng, "assistant stays quiet after the relay");

// 5) a team member writes from the WhatsApp Business app: the assistant pauses 24 h
const echo = JSON.stringify({ entry: [{ changes: [{ field: "smb_message_echoes", value: { message_echoes: [{ id: "e1" + T, from: "111", to: t2, type: "text", text: { body: "Bonjou, se Duke" } }] } }] }] });
await post(echo); await poz();
await post(msg("w6", t2, "Mèsi Duke")); await poz();
ok(sent.length === 4, "assistant quiet 24 h after a team member wrote from the phone");

// 6) Gemini fails: the conversation goes to a person
const f0 = globalThis.fetch;
globalThis.fetch = async (u, o) => String(u).includes("generativelanguage") ? new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 }) : f0(u, o);
await post(msg("w7", t3, "Bonjou"));
ok(await tann(async () => (await db.query("select alet from wa_konv where telefon = $1", [t3])).rows[0]?.alet), "Gemini error: conversation handed to the team");
globalThis.fetch = f0;

// staff functions never return the keys
const [, k] = await rpc("staf_wa_konfig", { p_code: "sekre-admin-123" });
const ks = JSON.stringify(k);
ok(k && k.gemini === true && !ks.includes("AIzaFAKE") && !ks.includes("EAAG") && !ks.includes(SEKRE_APP), "staff screen never receives the keys");
const [st2] = await rpc("wa_sv_konfig", { p_sekre: "nope" });
ok(st2 === 400, "server config refused without the server secret");

// 7) knowledge base reaches the WhatsApp assistant (not the internal-only cards)
await rpc("staf_konesans_mete", { p_code: "sekre-admin-123", p: { tit: "Parking", kontni: "Gen parking gratis devan lekòl la.", pou: "tou_de" } });
await rpc("staf_konesans_mete", { p_code: "sekre-admin-123", p: { tit: "Kòd pòt ekip", kontni: "Antre pa pòt dèyè a.", pou: "ekip" } });
gem.length = 0; plan = [{ text: "Wi, gen parking gratis." }];
await post(msg("w8", "509444" + T + "4", "Èske gen parking?")); await tann(() => gem.length === 1);
const si2 = gem[0]?.systemInstruction.parts[0].text || "";
ok(si2.includes("parking gratis") && !si2.includes("pòt dèyè"), "WhatsApp assistant reads the knowledge base, not internal cards");
ok(si2.includes("kapti ekran") && !/mande l voye nimewo tranzaksyon/.test(si2), "WhatsApp assistant asks for a payment screenshot, not a transaction number");

// 8) team assistant: report, project with themed lists, an expense task, a scheduled announcement — all through the member's session
const ekip = async (b) => { const r = await POST(new Request("http://x/api/whatsapp?ekip=1", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } })); return [r.status, await r.json()]; };
const [s0] = await ekip({ aksyon: "ajan", kod: "pa-bon", istwa: [{ sans: "in", teks: "rapò" }] });
ok(s0 === 403, "team assistant refuses a bad session");
gem.length = 0;
plan = [{ functionCall: { name: "rapo", args: {} } },
  { functionCall: { name: "kreye_pwoje", args: { tit: "Seminè AI desanm", lis: ["Lojistik", "Depans"] } } },
  { functionCall: { name: "kreye_travay", args: { tit: "Lwe pwojektè", pwoje: "semine ai", lis: "depans", montan: 4500, moun: "duke", dat: "2026-11-20" } } },
  { functionCall: { name: "voye_anons", args: { tit: "Reyinyon ekip", kontni: "Samdi 9è, sal 2.", pou: "tout", dat: "2026-12-01T08:00:00-05:00" } } },
  { functionCall: { name: "ekri_dokiman", args: { tit: "Rapò jodi a", kontni: "# Rapò\n- 1 peye" } } },
  { text: "Fè: rapò, pwojè, travay, anons pwograme ak dokiman." }];
const [s1, r1] = await ekip({ aksyon: "ajan", kod: "sekre-admin-123", istwa: [{ sans: "in", teks: "Prepare konferans lan pou mwen" }] });
ok(s1 === 200 && r1.teks.includes("pwojè") && r1.fe.length === 5 && r1.fe.every((f) => f.ok), "team assistant runs 5 tools and answers");
const sa = gem[0]?.systemInstruction.parts[0].text || "";
ok(sa.includes("Duke") && sa.includes("pòt dèyè") && !sa.includes("AIzaFAKE"), "team assistant knows who asks and the internal knowledge, never the keys");
const rapo = gem[1]?.contents.at(-1).parts[0].functionResponse.response;
ok(rapo && rapo.chif && typeof rapo.chif.inscrits === "number", "report tool returns live numbers");
const pj = (await db.query("select p.id, array_agg(l.tit order by l.ordre) lis from ekip_pwoje p join ekip_lis l on l.pwoje_id = p.id where p.tit = 'Seminè AI desanm' group by p.id")).rows[0];
ok(pj && pj.lis.join(",") === "Lojistik,Depans", "project created with its themed lists");
const tr = (await db.query("select t.montan, t.dat::text, l.tit, s.non from ekip_travay t join ekip_lis l on l.id = t.lis_id join staf s on s.id = t.moun where t.tit = 'Lwe pwojektè' and t.montan = 4500 and s.non = 'Duke' and t.dat = '2026-11-20' and l.pwoje_id = (select id from ekip_pwoje where tit = 'Seminè AI desanm')")).rows[0];
ok(tr && Number(tr.montan) === 4500 && tr.tit === "Depans" && tr.non === "Duke" && tr.dat === "2026-11-20", "expense task in the right list, owner and date (names matched loosely)");
const an = (await db.query("select pou, pibliye_le > now() pwograme from ekip_anons where tit = 'Reyinyon ekip'")).rows[0];
ok(an && an.pou === "tout" && an.pwograme, "announcement scheduled for a future date");
ok((await db.query("select 1 from ekip_dokiman where tit = 'Rapò jodi a'")).rowCount === 1, "report saved as a team document");
// a member without the right cannot publish: the database refuses, the assistant reports it
await db.query("insert into staf (non, role, statut, actif, idantifyan, modpas_hash, badj) values ('Asistan Tès', 'asistan', 'actif', true, 'asistantes@x.ht', extensions.crypt('modpas-asistan', extensions.gen_salt('bf', 4)), 'ASTES0000001') on conflict do nothing");
const [, lgA] = await rpc("staf_login", { p_idantifyan: "asistantes@x.ht", p_modpas: "modpas-asistan" });
plan = [{ functionCall: { name: "voye_anons", args: { tit: "Tès", kontni: "x" } } }, { text: "Ou pa gen aksè pou pibliye anons." }];
const [, r2] = await ekip({ aksyon: "ajan", kod: lgA.token, istwa: [{ sans: "in", teks: "Voye yon anons" }] });
ok(r2.fe?.[0]?.ok === false && (await db.query("select 1 from ekip_anons where tit = 'Tès'")).rowCount === 0, "member without the announcement right cannot publish through the assistant");
await db.end();
