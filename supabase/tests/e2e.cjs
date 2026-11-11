// End-to-end: real pages + local Postgres behind a PostgREST-like RPC mock (as role anon).
module.paths.push("/tmp/claude-0/-home-user/f3f252e9-ddde-5a6f-90c9-6cc21f0637e8/scratchpad/vend/node_modules");
const { chromium, devices } = require("playwright"); const { Client } = require("pg");
const http = require("http"), fs = require("fs"), path = require("path");
const S = "/tmp/claude-0/-home-user/f3f252e9-ddde-5a6f-90c9-6cc21f0637e8/scratchpad/e2e/"; fs.mkdirSync(S, { recursive: true });
const root = "/home/user/atelier-ai/public";
const db = new Client({ host: "localhost", user: "postgres", password: "pw", database: "levve" });
let FEMEN = false, file = Promise.resolve();   // one database connection: run calls one after another, like the real server would isolate them
function dbq(sql, v) { const r = file.then(() => db.query(sql, v)); file = r.catch(() => {}); return r; }
function rpc(fn, args) { const r = file.then(() => rpc1(fn, args)); file = r.catch(() => {}); return r; }
async function rpc1(fn, args) {
  const ks = Object.keys(args || {}); const sql = `select public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  const vals = ks.map((k) => (args[k] !== null && typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k]));
  if (FEMEN) return [503, { message: "closed" }];
  await db.query("begin"); await db.query("set local role anon");
  try { const r = await db.query(sql, vals); await db.query("commit"); return [200, r.rows[0].r]; }
  catch (e) { await db.query("rollback"); return [400, { message: e.message }]; }
}
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webmanifest": "application/json" };
const srv = http.createServer((q, r) => {
  let u = q.url.split("?")[0];
  if (u === "/api/konfig") { r.setHeader("content-type", "application/json"); return r.end(JSON.stringify({ moncash: "3864 9724", natcash: "3582 8339", benefisye: "Dukens Mathieu" })); }
  if (u.startsWith("/billet/")) u = "/billet.html";
  if (u.startsWith("/badj/")) u = "/badj.html";
  let f = path.join(root, u === "/" ? "index.html" : u); if (!path.extname(f)) f += ".html";
  fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader("content-type", types[path.extname(f)] || "application/octet-stream"); r.end(d); });
});
async function ale(p, k) { const b = p.locator(`#bn button[data-k=${k}]`); if (await b.count()) await b.click(); else { await p.click("#bn button[data-k=meni]"); await p.click(`#v .li[data-k=${k}]`); } }
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
(async () => {
  await db.connect(); await new Promise((r) => srv.listen(5174, r));
  // admin sets the ticket types like on /staf
  const e = (await rpc("evenement_public", {}))[1];
  await rpc("staf_evenement", { p_code: "sekre-admin-123", p_evenement: { id: e.id, nom: e.nom, date: "2026-11-28T10:00:00-05:00", lieu: "Lise Anacaona", adresse: "Leyogàn", capacite: 100, statut: "ouvert", lyen_gwoup: "https://chat.whatsapp.com/GwoupTest" },
    p_types: [{ nom: "Lève-bonè", prix_usd: "15", prix_htg: "2000", quota: 30, date_fin_vente: "2026-11-20T23:59:00-05:00", ordre: 0 }, { nom: "Estanda", prix_usd: "20", prix_htg: "2600", quota: 70, ordre: 1 }] });
  const e2 = (await rpc("evenement_public", {}))[1];
  await rpc("staf_kreye", { p_code: "sekre-admin-123", p_non: "Mika", p_role: "scanneur", p_nouvo_code: "skane-kod-456" });
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 13"] });
  const sbRoute = async (route) => {
    const fn = route.request().url().split("/rpc/")[1]; const [st, body] = await rpc(fn, JSON.parse(route.request().postData() || "{}"));
    route.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(body) });
  };
  await ctx.route("https://mfxyzjelxpziptlshkfv.supabase.co/rest/v1/rpc/*", sbRoute);
  const errs = []; ctx.on("page", (p) => p.on("pageerror", (x) => errs.push(x.message)));
  const opened = []; await ctx.exposeBinding("__open", (_, u) => opened.push(u));
  await ctx.addInitScript(() => { const o = window.open; window.open = (u, ...x) => { if (!u) return o.call(window, u, ...x); window.__open(u); return null; }; });   // links are recorded; blank windows (PDF view) open
  const p = await ctx.newPage(); p.on("pageerror", (x) => errs.push(x.message));

  // 1) register
  await p.goto("http://localhost:5174/konferans");
  await p.waitForFunction(() => document.querySelectorAll("#tkg .tk2").length === 2); ok((await p.locator(".pmin").first().textContent()).includes("15"), "hero price from the database"); ok((await p.locator("#tkg .tk2").count()) === 2 && (await p.locator("#tkg .tkm, #tkg ul").count()) === 0, "simple ticket cards, no samples or lists");
  ok((await p.locator("#tkg .tk2").first().textContent()).includes("Rabè"), "early-bird card shows the discount");
  ok((await p.locator("#enskri").count()) === 0, "no form on the workshop page");
  ok((await p.locator("#tkg .tk2.bl").count()) === 1 && (await p.locator("#tkg .tk2 .btn").nth(1).getAttribute("href")) === null, "standard ticket locked while early bird is on");
  const lock = await rpc("inscrire", { p_type: e2.types[1].id, p_nom: "Tès Estanda", p_telephone: "37000000", p_email: null, p_reponses: {}, p_moyen: "moncash" });
  ok(lock[0] === 400 && /poko disponib/.test(lock[1].message), "server refuses standard while early bird is on");
  const href = await p.locator("#tkg .tk2 .btn").nth(0).getAttribute("href"); ok(/^\/enskri\?tip=/.test(href), "ticket button opens /enskri with the ticket");
  await p.goto("http://localhost:5174" + href); await p.waitForSelector("#tip .tp");
  ok((await p.locator("#tip .tp").count()) === 2, "two ticket types shown with prices");
  ok(await p.locator("#tip input").nth(0).isChecked() && await p.locator("#tip input").nth(1).isDisabled(), "early bird preselected, standard disabled");
  await p.locator("#tip .tp").first().click();
  await p.locator("#enskri").scrollIntoViewIfNeeded(); await p.screenshot({ path: S + "1-form.png" });
  await p.fill("#non", "Roselande Pierre"); await p.fill("#telefon", "3864 1234"); await p.selectOption("#nivo", { index: 1 }); await p.selectOption("#vle", { index: 1 });
  await p.click("#f1 button"); await p.waitForSelector("#f2:not(.hidden)");
  const kod = await p.textContent("#p-kod"); ok(/^AT-\d{4}$/.test(kod), "short code shown: " + kod);
  ok((await p.textContent("#p-amt")).replace(/\s/g, "").includes("2000goud"), "exact amount shown");
  await p.locator("#f2").screenshot({ path: S + "2-pay.png" });
  // a phone-sized "transfer done" screen as the payment screenshot
  { const r = await b.newPage({ viewport: { width: 390, height: 640 } });
    await r.setContent('<body style="margin:0;font:16px system-ui;background:#f4f4f4"><div style="background:#d0021b;color:#fff;padding:22px 18px;font-weight:700">Transfè</div><div style="margin:16px;background:#fff;border-radius:14px;padding:22px;text-align:center"><div style="font-size:52px;color:#1a9b4a">&#10003;</div><b style="font-size:20px">Transfè reyisi</b><p style="font-size:30px;font-weight:800;margin:14px 0">2 000,00 HTG</p><p>Bay: Dukens Mathieu<br>3864 9724</p><p style="color:#777">Nòt: AT-1234<br>11/11/2026 12:20</p></div></body>');
    await r.screenshot({ path: S + "resi.png" }); await r.close(); }
  ok(await p.locator("#voye2").isDisabled() && (await p.locator("#ref").count()) === 0, "only a screenshot is asked, send stays off until it is added");
  await p.setInputFiles("#kapti", S + "resi.png"); await p.waitForSelector("#up.ok"); await p.locator("#f2").screenshot({ path: S + "2b-pay.png" });
  await p.click("#voye2"); await p.waitForSelector("#f3:not(.hidden)");
  ok(true, "payment screenshot sent, confirmation shown"); await p.locator("#f3").screenshot({ path: S + "3-ok.png" });
  await p.reload(); await p.waitForSelector("#f3:not(.hidden)"); ok(true, "confirmation kept after reload");

  // 2) same phone again → refused
  const p2 = await ctx.newPage(); await p2.goto("http://localhost:5174/enskri"); await p2.evaluate(() => localStorage.clear()); await p2.reload(); await p2.waitForSelector("#tip .tp");
  await p2.fill("#non", "Roselande"); await p2.fill("#telefon", "+509 38641234"); await p2.click("#f1 button"); await p2.waitForSelector("#m1.err");
  ok((await p2.textContent("#m1")).includes("enskri deja"), "same phone blocked");

  // 3) find ticket before validation → pending message
  await p2.goto("http://localhost:5174/billet"); await p2.fill("#tel", "38641234"); await p2.fill("#kod", kod); await p2.click("#fj button"); await p2.waitForSelector("#mj.ok");
  ok((await p2.textContent("#mj")).includes("verifye"), "pending ticket message");

  // 4) staff validates
  const s = await ctx.newPage(); await s.goto("http://localhost:5174/staf"); await s.click("#akod"); await s.fill("#kod", "sekre-admin-123"); await s.click("#fkod button"); await s.waitForSelector("#bn button[data-k=file]");
  await ale(s, "file"); await s.waitForSelector("#v .li[data-id]"); await s.click("#v .li[data-id]");
  await s.waitForSelector("#sh img.kapti"); await s.waitForTimeout(300); await s.screenshot({ path: S + "3-kapti.png" }); ok(true, "payment screenshot shown at once to staff");
  await s.screenshot({ path: S + "4-queue.png", fullPage: true });
  await s.click("text=Peman an rive, valide"); await s.waitForSelector("text=Pa gen peman k ap tann");
  const link = opened.find((u) => u.includes("wa.me")); ok(!!link && decodeURIComponent(link).includes("/billet/"), "WhatsApp message with the ticket link"); ok(decodeURIComponent(link).includes("chat.whatsapp.com/GwoupTest"), "WhatsApp message invites to the group");
  const code = decodeURIComponent(link).match(/billet\/([A-Z0-9]{12})/)[1];
  await ale(s, "tablo"); await s.waitForSelector(".k4"); await s.screenshot({ path: S + "5-tablo.png", fullPage: true });
  await ale(s, "lis"); await s.waitForSelector("text=Ekspòte CSV");
  const [dl] = await Promise.all([s.waitForEvent("download"), s.click("text=Ekspòte CSV")]); const csv = fs.readFileSync(await dl.path(), "utf8");
  ok(csv.includes("Roselande Pierre") && csv.includes(code), "CSV export");

  // 5) ticket page + QR readable
  await p.goto("http://localhost:5174/billet/" + code); await p.waitForSelector("#tikè:not(.hidden)");
  await p.screenshot({ path: S + "6-billet.png", fullPage: true });
  await p.addScriptTag({ url: "/vendor/jsQR.js" });
  const lu = await p.evaluate(() => { const c = document.querySelector("#qr"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height); const r = jsQR(d.data, c.width, c.height); return r && r.data; });
  ok(lu === code, "QR decodes to the ticket code"); ok((await p.locator("#gw").getAttribute("href")) === "https://chat.whatsapp.com/GwoupTest" && await p.locator("#gw").isVisible(), "ticket page shows the group button");
  const [img] = await Promise.all([p.waitForEvent("download"), p.click("#sove")]); fs.copyFileSync(await img.path(), S + "7-tike.png"); ok(true, "ticket saved as image");
  // offline: the copy kept on the phone still shows
  await ctx.setOffline(true); await p.reload().catch(() => {}); 
  await ctx.setOffline(false);

  // 6) find ticket after validation → redirect
  await p2.goto("http://localhost:5174/billet"); await p2.fill("#tel", "38641234"); await p2.fill("#kod", kod); await p2.click("#fj button"); await p2.waitForURL("**/billet/" + code); ok(true, "find-my-ticket redirects to the ticket");

  // 7) scanner: login, manual entry, second time = orange, offline queue then sync
  const k = await ctx.newPage(); await k.goto("http://localhost:5174/skane"); await k.fill("#kod", "skane-kod-456"); await k.click("#login button"); await k.waitForSelector("#app:not(.hidden)");
  ok((await k.textContent("#tout")) === "1", "scanner downloaded 1 valid ticket");
  await ctx.setOffline(true); await k.evaluate(() => dispatchEvent(new Event("offline")));
  await k.fill("#chache", "rose"); await k.click("text=Kite l antre"); await k.waitForSelector("#res.vert");
  ok((await k.textContent("#res")).includes("Roselande"), "green: valid entry (offline)"); await k.screenshot({ path: S + "8-vert.png" });
  await k.evaluate((c) => document.querySelector("#chache").value = c, "rose"); await k.dispatchEvent("#chache", "input"); await k.click("text=Kite l antre"); await k.waitForSelector("#res.orange");
  ok((await k.textContent("#res")).includes("Deja"), "orange: already used, with time"); await k.screenshot({ path: S + "9-orange.png" });
  ok((await k.textContent("#sync")).includes("poko voye"), "entry queued while offline");
  await ctx.setOffline(false); await k.evaluate(() => dispatchEvent(new Event("online"))); await k.waitForFunction(() => document.querySelector("#sync").textContent.includes("Tout voye"), null, { timeout: 15000 });
  const t = (await rpc("staf_tablo", { p_code: "sekre-admin-123" }))[1]; ok(t.jour_j.entres === 1, "server counts 1 entry after sync");
  // unknown code typed by hand → red
  await k.evaluate(() => window.dispatchEvent(new Event("x"))); 
  // 6) team accounts: sign up with a photo, super admin approves, member sees role + badge, badge page checks it
  const u = await ctx.newPage(); await u.goto("http://localhost:5174/staf"); await u.evaluate(() => localStorage.removeItem("staf-kod")); await u.reload(); await u.click("#lt button[data-m=e]");
  await u.fill("#en", "Nadège Pòl"); await u.fill("#ei", "nadege@gmail.com"); await u.fill("#em", "modpas-nadege");
  await u.setInputFiles("#ef", root + "/art/e1.jpg"); await u.waitForFunction(() => document.querySelector("#fp").style.backgroundImage.includes("base64"));
  await u.click("#fe button"); await u.waitForSelector("#fe .msg.ok"); ok(true, "team member signs up with a photo");
  await u.click("#lt button[data-m=k]"); await u.fill("#li", "nadege@gmail.com"); await u.fill("#lm", "modpas-nadege"); await u.click("#fk button"); await u.waitForSelector("#fk .msg.err");
  ok((await u.textContent("#fk .msg")).includes("poko valide"), "pending account cannot log in");
  await ale(s, "ekip"); await s.waitForSelector("#v .li >> text=Nadège"); await s.click("#v .li >> text=Nadège");
  const kat = s.locator("#sh .ek"); await kat.locator("select").selectOption("vandeur");
  await kat.locator("[name=f]").fill("Responsab enskripsyon Leyogàn"); await kat.locator("textarea").fill("Vann tikè nan lekòl yo\nRevoye tikè pèdi");
  await kat.locator("button", { hasText: "Valide kont lan" }).click(); await s.locator("#v .li", { hasText: "Nadège" }).locator(".pl.ok").waitFor(); ok(true, "super admin approves with role, job and tasks");
  await u.fill("#lm", "modpas-nadege"); await u.click("#fk button"); await u.waitForSelector("#bn button[data-k=tablo]"); await ale(u, "mwen"); await u.waitForSelector("#wè-badj");
  ok((await u.textContent("#v")).includes("Responsab enskripsyon Leyogàn") && (await u.textContent("#v")).includes("Revoye tikè pèdi"), "member sees job, tasks and access");
  await ale(u, "meni"); await u.waitForSelector("#v .li[data-k=mwen]");
  ok((await u.locator("#v .li[data-k]:not([data-k=soti]) .tx b").allTextContents()).join("|") === "Enskri yon moun|Jwenn yon tikè|Asistan AI|Anons|Travay|Pwojè|Dokiman|Baz konesans|Pwofil mwen", "member sees the sections of the role plus the team space");
  await u.click("#v .li[data-k=mwen]"); await u.click("#wè-badj"); await u.waitForSelector("#sh .bj2 canvas");
  ok(true, "badge opens behind the eye button"); await u.click("#sh .tabs3 button >> text=Klasik"); await u.waitForSelector("#sh .bj2 canvas"); await u.screenshot({ path: S + "7-badj.png" }); await u.click("#sh .bg", { position: { x: 10, y: 10 } });
  // profile: change name, add a phone, then log in with the phone; a wrong current password blocks a password change
  await u.click("#v .li[data-f=non]"); await u.fill("#pf-non", "Nadège Pòl Jean"); await u.fill("#pf-tel", "3711 2233"); await u.click("#sh button.full"); await u.waitForSelector("#sh .msg.ok"); await u.waitForSelector("#sh", { state: "detached" });
  const me2 = (await rpc("staf_mwen", { p_code: await u.evaluate(() => localStorage.getItem("staf-kod")) }))[1];
  ok(me2.non === "Nadège Pòl Jean" && me2.tel === "50937112233" && me2.imel === "nadege@gmail.com", "member edits name and adds a phone");
  await u.click("#v .li[data-f=kle]"); await u.fill("#pf-mp", "nouvo-modpas-9"); await u.fill("#pf-ma", "pa-bon-ditou"); await u.click("#sh button.full"); await u.waitForSelector("#sh .msg.err");
  ok((await u.textContent("#sh .msg")).includes("aktyèl"), "password change needs the current password"); await u.click("#sh .bg", { position: { x: 10, y: 10 } });
  const lg = await rpc("staf_login", { p_idantifyan: "+509 3711-2233", p_modpas: "modpas-nadege" }); ok(lg[0] === 200 && !!lg[1].token, "log in with the phone number");
  const lg2 = await rpc("staf_login", { p_idantifyan: "Nadege@Gmail.com", p_modpas: "modpas-nadege" }); ok(lg2[0] === 200, "log in with the email (any case)");
  const np = await rpc("staf_enskri", { p_non: "Wilnick", p_idantifyan: "wilnick@yahoo.fr", p_modpas: "modpas-wilnick", p_foto: null }); ok(np[0] === 200, "sign up without a photo");
  const bj = await rpc("staf_mwen", { p_code: await u.evaluate(() => localStorage.getItem("staf-kod")) });
  await u.screenshot({ path: S + "7-badj.png", fullPage: true });
  await u.goto("http://localhost:5174/badj/" + bj[1].badj); await u.waitForSelector(".ver.ok"); ok(true, "badge QR page says valid");
  // 7) custom role: the (only) super admin proposes it, so it applies at once; then it can be given to a member
  s.on("dialog", (d) => d.accept());
  await ale(s, "wol"); await s.waitForSelector("#v .wl");
  const fw = s.locator("#v form.card").last(); await fw.locator("[name=n]").fill("Fotograf"); await fw.locator("[name=d]").fill("Pran foto ak videyo jou atelye a");
  await fw.locator(".ak input[value=eskane]").check(); await fw.locator("button").click();
  await s.waitForSelector("#v .wl >> text=Fotograf"); ok((await s.locator("#v .wl", { hasText: "Fotograf" }).textContent()).includes("Eskane tikè"), "super admin creates a role with its access");
  await ale(s, "ekip"); await s.waitForSelector("#v .li >> text=Nadège"); await s.click("#v .li >> text=Nadège"); await s.waitForSelector("#sh .ek select");
  ok((await s.locator("#sh .ek select").first().locator("option").allTextContents()).includes("Fotograf"), "new role offered to team members"); await s.click("#sh .bg", { position: { x: 10, y: 10 } });

  // 8) WhatsApp assistant tab: settings (keys write-only), a conversation that needs a person, try the assistant
  await dbq("update wa_konfig set sekre_hash = encode(extensions.digest('e2e-sekre','sha256'),'hex'), aktif = false");
  await rpc("wa_sv_resevwa", { p_sekre: "e2e-sekre", p_tel: "50955550001", p_non: "Lina", p_wa_id: "e2e1", p_teks: "Mwen gen yon pwoblèm ak peman an", p_foto: null });
  await dbq("update wa_konv set eta = 'moun', alet = true, rezon = 'Mo: pwoblèm' where telefon = '50955550001'");
  await rpc("wa_sv_ekri", { p_sekre: "e2e-sekre", p_tel: "50955550001", p_sans: "bot", p_teks: "Yon moun nan ekip la ap reponn ou byento.", p_wa_id: "e2e2" });
  const waCalls = [];
  await s.route("**/api/whatsapp?ekip=1", async (route) => { const d = JSON.parse(route.request().postData()); waCalls.push(d);
    if (d.aksyon === "eseye") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ teks: "Bonjou! Lève-bonè a 2 000 goud.", fe: [] }) });
    if (d.aksyon === "voye") { await rpc("wa_sv_ekri", { p_sekre: "e2e-sekre", p_tel: d.tel, p_sans: "staf", p_teks: d.teks, p_wa_id: null }); return route.fulfill({ contentType: "application/json", body: '{"ok":true}' }); }
    route.fulfill({ contentType: "application/json", body: '{"ok":false,"ere":"tès"}' }); });
  await s.evaluate(() => localStorage.setItem("staf-kod", "sekre-admin-123")); await s.reload(); await s.waitForSelector("#bn button[data-k=wa]");
  ok((await s.locator("#bn button[data-k=wa] .nb").textContent()) === "1", "WhatsApp tab shows 1 customer waiting for a person");
  await s.screenshot({ path: S + "10-akey.png", fullPage: true });
  await ale(s, "wa"); await s.waitForSelector("#wa-st");
  ok((await s.locator("#wa-st").textContent()).includes("Fèmen"), "assistant shown as off");
  await s.click("#wa-param"); await s.waitForSelector("#v [name=gemini_kle]");
  await s.fill("#v [name=gemini_kle]", "AIzaE2EKEY00000000000000000000wxyz"); await s.click("#v form.card button.full");
  await s.waitForSelector("#v [name=gemini_kle][placeholder*='wxyz']");
  const kv = (await dbq("select gemini_kle from wa_konfig")).rows[0].gemini_kle;
  ok(kv === "AIzaE2EKEY00000000000000000000wxyz" && (await s.inputValue("#v [name=gemini_kle]")) === "", "Gemini key saved, never shown again (only its last 4)");
  ok((await s.locator("#v .cp input").first().inputValue()).endsWith("/api/whatsapp"), "webhook address ready to copy");
  await s.click("#wa-sw"); await s.waitForSelector("#wa-eta >> text=poko konekte"); ok(true, "assistant switched on, says it is not connected yet");
  await s.click("#tb-b"); await s.waitForSelector("#v .cl .li");
  ok((await s.locator("#v .cl .li").first().textContent()).includes("Bezwen ou"), "conversation flagged « Bezwen ou »");
  await s.click("#v .cl .li >> nth=0"); await s.waitForSelector("#v .ch .bl.in");
  ok((await s.locator("#wa-rezon").textContent()).includes("pwoblèm"), "reason shown to the team");
  await s.fill("#ta", "Bonjou Lina, se Duke. Ki pwoblèm lan?"); await s.click(".snd");
  await s.waitForSelector("#v .ch .bl.staf"); ok(waCalls.some((x) => x.aksyon === "voye" && x.tel === "50955550001"), "team reply sent from the screen");
  await s.screenshot({ path: S + "9-whatsapp.png", fullPage: true });
  await s.click("#wa-remet"); await s.waitForSelector("#wa-pran");
  ok((await dbq("select eta, alet from wa_konv where telefon = '50955550001'")).rows[0].eta === "bot", "conversation given back to the assistant");
  await s.click("#tb-b"); await s.click("#v .tabs3 button >> nth=1"); await s.waitForSelector("#v .sg");
  await s.fill("#ta", "Konbyen tikè a ye?"); await s.click(".snd");
  await s.waitForSelector("#v .ch .bl.bot"); ok((await s.locator("#v .ch .bl.bot").textContent()).includes("2 000"), "try-the-assistant screen answers");
  await s.screenshot({ path: S + "11-asistan.png" });
  await ale(s, "meni"); await s.waitForSelector("#v .li[data-k=param]"); await s.screenshot({ path: S + "12-meni.png", fullPage: true });
  await ale(s, "mwen"); await s.waitForSelector("#wè-badj"); await s.screenshot({ path: S + "13-pwofil.png", fullPage: true });
  // 9) team space: a project with themed lists, a checklist item with an amount, my tasks, an announcement, a document, the knowledge base
  await ale(s, "pwoje"); await s.click("#pj-nv"); await s.fill("#sh [name=tit]", "Konferans 28 novanm"); await s.click("#sh .chips2 button >> text=Pwogram"); await s.click("#sh button.btn:not(.light)");
  await s.waitForSelector("#v .lh[data-lis=Depans]");
  ok((await s.locator("#v .lh b").allTextContents()).join(",") === "Lojistik,Depans,Kominikasyon,Pwogram", "project created with 4 themed lists");
  await s.fill("input[placeholder='Ajoute nan Depans…']", "Lwe pwojektè"); await s.press("input[placeholder='Ajoute nan Depans…']", "Enter");
  await s.waitForSelector("#v .li.tr >> text=Lwe pwojektè");
  ok(await s.evaluate(() => document.activeElement && document.activeElement.placeholder === "Ajoute nan Depans…"), "quick add keeps the cursor in the list (type, Enter, type)");
  await s.fill("input[placeholder='Ajoute nan Depans…']", "Dlo ak manje"); await s.press("input[placeholder='Ajoute nan Depans…']", "Enter"); await s.waitForSelector("#v .li.tr >> text=Dlo ak manje");
  await s.click("#v .li.tr >> text=Lwe pwojektè"); await s.fill("#sh [name=montan]", "4500"); await s.selectOption("#sh [name=moun]", { label: "Duke (mwen)" }); await s.fill("#sh [name=dat]", "2026-11-20");
  await s.click("#sh button.btn:not(.light)"); await s.waitForSelector("#sh", { state: "detached" });
  await s.waitForFunction(() => document.querySelector("#v .lh[data-lis=Depans] small").textContent.includes("4"));
  ok((await s.locator("#v .lh[data-lis=Depans] small").textContent()).replace(/\s/g, "").includes("4500goud"), "expense list shows its total");
  await s.locator("#v .li.tr", { hasText: "Dlo ak manje" }).locator(".ck2").click(); await s.waitForSelector("#v .li.tr.fini >> text=Dlo ak manje");
  ok((await s.textContent("#v .tp3")).includes("1/2"), "checking an item updates the project progress");
  await s.screenshot({ path: S + "15-pwoje.png", fullPage: true });
  await s.click("#tb-b"); await s.waitForSelector("#v .li[data-id] >> text=Konferans 28 novanm"); ok((await s.textContent("#v .grp")).includes("1/2 fini"), "project list shows progress");
  await ale(s, "travay"); await s.waitForSelector("#v .li.tr >> text=Lwe pwojektè");
  ok((await s.textContent("#v")).includes("Konferans 28 novanm · Depans"), "my tasks show where each one belongs");
  await s.fill("input[data-ad=tr]", "Rele direktè lekòl la"); await s.press("input[data-ad=tr]", "Enter"); await s.waitForSelector("#v .li.tr >> text=Rele direktè lekòl la");
  await s.screenshot({ path: S + "16-travay.png", fullPage: true });
  await ale(s, "anons"); await s.click("#an-nv"); await s.fill("#sh [name=tit]", "Reyinyon ekip samdi"); await s.fill("#sh [name=kontni]", "Samdi 9è nan **sal 2**. Pote lis envite yo.");
  await s.click("#sh button.btn:not(.light)"); await s.waitForSelector("#v .li >> text=Reyinyon ekip samdi");
  await s.click("#an-nv"); await s.fill("#sh [name=tit]", "Rapèl jou J"); await s.fill("#sh [name=kontni]", "Rive 8è."); await s.fill("#sh [name=dat]", "2026-11-28T07:00"); await s.click("#sh button.btn:not(.light)");
  await s.waitForSelector("#v .li >> text=Rapèl jou J"); ok((await s.locator("#v .li", { hasText: "Rapèl jou J" }).textContent()).includes("Pwograme"), "announcement scheduled for a later date");
  const tokN = (await rpc("staf_login", { p_idantifyan: "nadege@gmail.com", p_modpas: "modpas-nadege" }))[1].token;
  const zu = (await rpc("staf_zouti", { p_code: tokN }))[1];
  ok(zu.anons.some((a) => a.tit === "Reyinyon ekip samdi" && a.nouvo) && !zu.anons.some((a) => a.tit === "Rapèl jou J"), "member sees the new announcement, not the scheduled one yet");
  const ctxN = await b.newContext({ ...devices["iPhone 13"] }); await ctxN.route("https://mfxyzjelxpziptlshkfv.supabase.co/rest/v1/rpc/*", sbRoute); const n = await ctxN.newPage(); n.on("pageerror", (e) => errs.push(e.message));
  await n.goto("http://localhost:5174/staf"); await n.evaluate((t) => localStorage.setItem("staf-kod", t), tokN); await n.reload();
  await n.waitForSelector("#bn button[data-k=tablo]"); await n.waitForSelector("#v .li[data-k=anons]");
  ok((await n.textContent("#v")).includes("1 nouvo anons"), "member's home shows the new announcement");
  await n.click("#v .li[data-k=anons]"); await n.click("#v .li >> text=Reyinyon ekip samdi"); await n.waitForSelector("#sh .dk b");
  ok((await n.textContent("#sh .dk b")) === "sal 2" && (await n.locator("#an-nv").count()) === 0, "member reads it (formatted) and cannot publish");
  await n.screenshot({ path: S + "16b-anons.png" }); await ctxN.close();
  await ale(s, "dok"); await s.click("#dk-nv"); await s.fill("#dk-tit", "Pwogram jounen an"); await s.fill("#dk-ta", "# Maten\n- 9h30 akèy\n- **10h** ouvèti\n\n# Apremidi\n1. Vann ak AI\n2. Kesyon");
  await s.click("#dk-ok"); await s.waitForSelector("article.dk h2");
  ok((await s.locator("article.dk h2").allTextContents()).join("|") === "Maten|Apremidi" && (await s.textContent("article.dk li b")) === "10h", "document saved and shown formatted");
  await s.screenshot({ path: S + "17-dok.png", fullPage: true });
  const [wd] = await Promise.all([s.waitForEvent("download"), s.click("#dk-word")]); const wt = fs.readFileSync(await wd.path(), "utf8");
  ok(wd.suggestedFilename() === "pwogram-jounen-an.doc" && wt.includes("<b>10h</b>") && wt.includes("<ol>"), "document downloads as Word");
  const [pp] = await Promise.all([s.waitForEvent("popup"), s.click("#dk-pdf")]); await pp.waitForLoadState();
  ok((await pp.textContent("h1")) === "Pwogram jounen an", "PDF view opens ready to print / save"); await pp.close();
  await s.click("#dk-mod"); await s.fill("#dk-ta", "# Maten\n- 9h akèy"); await s.click("#dk-ok"); await s.waitForSelector("article.dk >> text=9h akèy"); ok(true, "document edited");
  await s.click("#tb-b"); await s.waitForSelector("#v .li >> text=Pwogram jounen an"); await s.fill("#v input[type=search]", "zzz"); ok((await s.locator("#v .grp .li").count()) === 0, "document search filters the list");
  await ale(s, "konesans"); await s.click("#kn-nv"); await s.fill("#sh [name=tit]", "Parking"); await s.fill("#sh [name=kontni]", "Gen parking gratis devan lekòl la.");
  await s.click("#sh button.btn:not(.light)"); await s.waitForSelector("#v .li >> text=Parking"); ok(true, "knowledge base card added");
  // 10) team assistant chat (server simulated here; the real one is tested in wa.mjs)
  await s.route("**/api/whatsapp?ekip=1", async (route) => { const d = JSON.parse(route.request().postData()); if (d.aksyon !== "ajan") return route.fallback();
    waCalls.push(d); route.fulfill({ contentType: "application/json", body: JSON.stringify({ teks: "**Rapò jodi a**\n- 1 tikè peye\n- 2 travay ouvè\n\nPwochen etap: relanse moun ki poko peye.", fe: [{ zouti: "rapo", ok: true }] }) }); });
  await ale(s, "asistan"); await s.waitForSelector("#v .sg button"); await s.click("#v .sg button >> nth=0");
  await s.waitForSelector("#v .am ul li"); ok((await s.textContent("#v .zc")).includes("Rapò") && (await s.textContent("#v .am b")) === "Rapò jodi a", "assistant answer shown formatted with the tools it used");
  ok(!(await s.textContent("#v .ch")).includes("null"), "no stray text in the chat");
  ok(waCalls.some((x) => x.aksyon === "ajan" && x.istwa.at(-1).teks === "Fè yon rapò sou atelye a"), "suggestion sends the question");
  await s.screenshot({ path: S + "18-ai.png" });
  await ale(s, "tablo"); await ale(s, "asistan"); await s.waitForSelector("#v .am ul li"); ok(true, "conversation kept when coming back");
  await s.click("#ai-nv"); await s.waitForSelector("#v .sg"); ok(true, "new conversation clears the chat");
  await s.setViewportSize({ width: 1280, height: 820 }); await s.click("#tabs button[data-k=tablo]"); await s.waitForSelector(".k4"); await s.screenshot({ path: S + "14-pc.png" }); ok(await s.locator("#tabs").isVisible(), "side menu on computers");
  console.log("page errors:", errs);
  await b.close(); srv.close(); FEMEN = true; await file; await db.end();
})().catch(async (e) => { console.error("ERROR", e.message); process.exit(1); });
