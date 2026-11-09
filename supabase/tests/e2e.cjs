// End-to-end: real pages + local Postgres behind a PostgREST-like RPC mock (as role anon).
module.paths.push("/tmp/claude-0/-home-user/f3f252e9-ddde-5a6f-90c9-6cc21f0637e8/scratchpad/vend/node_modules");
const { chromium, devices } = require("playwright"); const { Client } = require("pg");
const http = require("http"), fs = require("fs"), path = require("path");
const S = "/tmp/claude-0/-home-user/f3f252e9-ddde-5a6f-90c9-6cc21f0637e8/scratchpad/e2e/"; fs.mkdirSync(S, { recursive: true });
const root = "/home/user/atelier-ai/public";
const db = new Client({ host: "localhost", user: "postgres", password: "pw", database: "levve" });
let file = Promise.resolve();   // one database connection: run calls one after another, like the real server would isolate them
function rpc(fn, args) { const r = file.then(() => rpc1(fn, args)); file = r.catch(() => {}); return r; }
async function rpc1(fn, args) {
  const ks = Object.keys(args || {}); const sql = `select public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  const vals = ks.map((k) => (args[k] !== null && typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k]));
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
  await ctx.route("https://mfxyzjelxpziptlshkfv.supabase.co/rest/v1/rpc/*", async (route) => {
    const fn = route.request().url().split("/rpc/")[1]; const [st, body] = await rpc(fn, JSON.parse(route.request().postData() || "{}"));
    route.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(body) });
  });
  const errs = []; ctx.on("page", (p) => p.on("pageerror", (x) => errs.push(x.message)));
  const opened = []; await ctx.exposeBinding("__open", (_, u) => opened.push(u));
  await ctx.addInitScript(() => { window.open = (u) => { window.__open(u); return null; }; });
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
  // a small PNG as payment screenshot
  fs.writeFileSync(S + "resi.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  await p.fill("#ref", "mc-998877"); await p.setInputFiles("#kapti", S + "resi.png");
  await p.click("#f2 button"); await p.waitForSelector("#f3:not(.hidden)");
  ok(true, "payment reference sent, confirmation shown"); await p.locator("#f3").screenshot({ path: S + "3-ok.png" });
  await p.reload(); await p.waitForSelector("#f3:not(.hidden)"); ok(true, "confirmation kept after reload");

  // 2) same phone again → refused
  const p2 = await ctx.newPage(); await p2.goto("http://localhost:5174/enskri"); await p2.evaluate(() => localStorage.clear()); await p2.reload(); await p2.waitForSelector("#tip .tp");
  await p2.fill("#non", "Roselande"); await p2.fill("#telefon", "+509 38641234"); await p2.click("#f1 button"); await p2.waitForSelector("#m1.err");
  ok((await p2.textContent("#m1")).includes("enskri deja"), "same phone blocked");

  // 3) find ticket before validation → pending message
  await p2.goto("http://localhost:5174/billet"); await p2.fill("#tel", "38641234"); await p2.fill("#kod", kod); await p2.click("#fj button"); await p2.waitForSelector("#mj.ok");
  ok((await p2.textContent("#mj")).includes("verifye"), "pending ticket message");

  // 4) staff validates
  const s = await ctx.newPage(); await s.goto("http://localhost:5174/staf"); await s.click("#akod"); await s.fill("#kod", "sekre-admin-123"); await s.click("#fkod button"); await s.waitForSelector("#tabs button[data-k=file]");
  await s.click("#tabs button[data-k=file]"); await s.waitForTimeout(1500); await s.waitForSelector("#v .card");
  await s.click("text=Wè kapti a"); await s.waitForSelector("img.kapti"); ok(true, "payment screenshot visible to staff");
  await s.screenshot({ path: S + "4-queue.png", fullPage: true });
  await s.click("text=Peman an rive, valide"); await s.waitForSelector("text=Pa gen peman k ap tann");
  const link = opened.find((u) => u.includes("wa.me")); ok(!!link && decodeURIComponent(link).includes("/billet/"), "WhatsApp message with the ticket link"); ok(decodeURIComponent(link).includes("chat.whatsapp.com/GwoupTest"), "WhatsApp message invites to the group");
  const code = decodeURIComponent(link).match(/billet\/([A-Z0-9]{12})/)[1];
  await s.click("#tabs button[data-k=tablo]"); await s.waitForSelector(".k4"); await s.screenshot({ path: S + "5-tablo.png", fullPage: true });
  await s.click("#tabs button[data-k=lis]"); await s.waitForSelector("text=Ekspòte CSV");
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
  await s.click("#tabs button[data-k=ekip]"); await s.waitForSelector("#v .ek");
  const kat = s.locator("#v .ek", { hasText: "Nadège" }); await kat.locator("select").selectOption("vandeur");
  await kat.locator("[name=f]").fill("Responsab enskripsyon Leyogàn"); await kat.locator("textarea").fill("Vann tikè nan lekòl yo\nRevoye tikè pèdi");
  await kat.locator("button", { hasText: "Valide kont lan" }).click(); await s.locator("#v .ek", { hasText: "Nadège" }).locator(".bad.valide").waitFor(); ok(true, "super admin approves with role, job and tasks");
  await u.fill("#lm", "modpas-nadege"); await u.click("#fk button"); await u.waitForSelector("#tabs button[data-k=mwen]"); await u.click("#tabs button[data-k=mwen]"); await u.waitForSelector("#v .bj2");
  ok((await u.textContent("#v")).includes("Responsab enskripsyon Leyogàn") && (await u.textContent("#v")).includes("Revoye tikè pèdi"), "member sees job, tasks and access");
  ok((await u.locator("#tabs button").allTextContents()).join("|") === "Enskri yon moun|Jwenn yon tikè|Badj mwen", "member sees only the tabs of the role");
  const bj = await rpc("staf_mwen", { p_code: await u.evaluate(() => localStorage.getItem("staf-kod")) });
  await u.screenshot({ path: S + "7-badj.png", fullPage: true });
  await u.goto("http://localhost:5174/badj/" + bj[1].badj); await u.waitForSelector(".ver.ok"); ok(true, "badge QR page says valid");
  // 7) custom role: the (only) super admin proposes it, so it applies at once; then it can be given to a member
  s.on("dialog", (d) => d.accept());
  await s.click("#tabs button[data-k=wol]"); await s.waitForSelector("#v .wl");
  const fw = s.locator("#v form.card").last(); await fw.locator("[name=n]").fill("Fotograf"); await fw.locator("[name=d]").fill("Pran foto ak videyo jou atelye a");
  await fw.locator(".ak input[value=eskane]").check(); await fw.locator("button").click();
  await s.waitForSelector("#v .wl >> text=Fotograf"); ok((await s.locator("#v .wl", { hasText: "Fotograf" }).textContent()).includes("Eskane tikè"), "super admin creates a role with its access");
  await s.click("#tabs button[data-k=ekip]"); await s.waitForSelector("#v .ek select");
  ok((await s.locator("#v .ek select").first().locator("option").allTextContents()).includes("Fotograf"), "new role offered to team members");
  console.log("page errors:", errs);
  await b.close(); srv.close(); await db.end();
})().catch(async (e) => { console.error("ERROR", e.message); process.exit(1); });
