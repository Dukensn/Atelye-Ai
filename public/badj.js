// Event badge, worn on a lanyard: team members (photo, role colour band) and attendees (ticket QR).
// The QR opens /badj/<code> for team members and /billet/<code> for attendees (the door scanner reads it).
(() => {
  const ROL = { admin: "Super admin", validateur: "Validatè", vandeur: "Vandè", scanneur: "Eskanè", patisipan: "Patisipan" };
  const KOU = { admin: ["#ffc83d", "#111"], validateur: ["#3b82f6", "#fff"], vandeur: ["#22c55e", "#fff"], scanneur: ["#f97316", "#fff"], patisipan: ["#d7ff3a", "#111"] };
  const SLOGAN = ["Kreye.", "Vann.", "Otomatize."];
  const css = `
  .bj2 { --w: 340px; width: var(--w); max-width: 100%; aspect-ratio: 54/86; margin: 0 auto; position: relative; border-radius: 24px; overflow: hidden;
    background: #fff; color: #111; font-family: Inter, system-ui, sans-serif; box-shadow: 0 18px 40px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06); display: flex; flex-direction: column; container-type: inline-size; }
  .bj2 .hd { position: relative; height: 31%; background: #0f0f0f; color: #fff; padding: 9cqw 7cqw 0; overflow: hidden; }
  .bj2 .hd::before { content: ""; position: absolute; right: -18cqw; top: -10cqw; width: 70cqw; height: 70cqw; border-radius: 50%; background: radial-gradient(circle, rgba(215,255,58,.35), transparent 65%); }
  .bj2 .hd::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1.6cqw; background: linear-gradient(90deg, #d7ff3a, #ffc83d, #f97316); }
  .bj2 .sl { position: absolute; left: 50%; top: 3.2cqw; width: 18cqw; height: 3.4cqw; margin-left: -9cqw; border-radius: 2cqw; background: #fff; box-shadow: inset 0 1px 3px rgba(0,0,0,.5); }
  .bj2 .br { position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 3cqw; }
  .bj2 .lo { flex: none; width: 15cqw; height: 12cqw; border-radius: 3cqw; background: #fff; display: grid; place-items: center; } .bj2 .lo img { width: 11.5cqw; }
  .bj2 .ev { text-align: right; } .bj2 .ev b { display: block; font-size: 4.1cqw; font-weight: 800; letter-spacing: .16em; color: #d7ff3a; }
  .bj2 .ev span { display: block; font-size: 3.5cqw; font-weight: 600; color: #cfcfcf; margin-top: 1cqw; letter-spacing: .04em; }
  .bj2 .ph { position: relative; z-index: 1; width: 40cqw; aspect-ratio: 4/5; margin: -15cqw auto 0; border-radius: 6cqw; border: 1.6cqw solid #fff; background: #eee center/cover no-repeat;
    box-shadow: 0 2cqw 6cqw rgba(0,0,0,.18); display: grid; place-items: center; font-size: 15cqw; font-weight: 800; color: #111; }
  .bj2 .nm { text-align: center; font-size: 8.2cqw; font-weight: 800; letter-spacing: -.02em; line-height: 1.05; margin: 4cqw 6cqw 0; overflow-wrap: anywhere; }
  .bj2 .fn { text-align: center; font-size: 3.9cqw; color: #666; margin: 1.6cqw 6cqw 0; min-height: 1.2em; }
  .bj2 .mi { flex: 1; display: flex; align-items: center; gap: 4cqw; margin: 3cqw 6cqw 0; padding-top: 3cqw; border-top: .5cqw dashed #e2e2e2; }
  .bj2 canvas { flex: none; width: 25cqw; height: 25cqw; image-rendering: pixelated; }
  .bj2 .sg { flex: 1; } .bj2 .sg b { display: block; font-size: 5.6cqw; font-weight: 800; line-height: 1.05; letter-spacing: -.02em; }
  .bj2 .sg b:nth-child(3) { color: #f97316; } .bj2 .sg small { display: block; margin-top: 1.6cqw; font-size: 3.2cqw; font-weight: 700; letter-spacing: .14em; color: #999; }
  .bj2 .rl { height: 13%; display: flex; align-items: center; justify-content: center; font-size: 6.4cqw; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }`;
  let stil = false;
  const inisyal = (n) => String(n || "?").split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const dat = (e) => (e && e.date && window.SB) ? SB.dat(e.date, { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".") : "28.11.2026";
  const lyen = (b) => b.kind === "patisipan" ? `${location.origin}/billet/${b.code}` : `${location.origin}/badj/${b.badj}`;
  const kle = (b) => b.kind === "patisipan" ? "patisipan" : (b.role in KOU ? b.role : "patisipan");

  function qr(c, txt) {
    const q = qrcode(0, "M"); q.addData(txt); q.make();
    const n = q.getModuleCount(), m = 1, s = Math.floor(c.width / (n + 2 * m)), o = Math.floor((c.width - s * n) / 2), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(o + k * s, o + r * s, s, s);
  }

  // b: { kind: "ekip"|"patisipan", non, role, fonksyon, foto, badj, code, tip, evenement }
  function rann(b) {
    if (!stil) { stil = true; const s = document.createElement("style"); s.textContent = css; document.head.append(s); }
    const k = kle(b), [bg, fg] = KOU[k], d = document.createElement("div"); d.className = "bj2";
    d.innerHTML = `<div class="hd"><span class="sl"></span><div class="br"><span class="lo"><img src="/logo.png" alt="Atelye AI"></span>
        <div class="ev"><b>ATELYE KONFERANS</b><span></span><span>Lise Anacaona · Leyogàn</span></div></div></div>
      <div class="ph"></div><div class="nm"></div><div class="fn"></div>
      <div class="mi"><canvas width="240" height="240" aria-label="Kòd QR"></canvas><div class="sg">${SLOGAN.map((x) => `<b>${x}</b>`).join("")}<small></small></div></div>
      <div class="rl"></div>`;
    d.querySelector(".ev span").textContent = dat(b.evenement);
    const ph = d.querySelector(".ph");
    if (b.foto) ph.style.backgroundImage = `url(data:image/jpeg;base64,${b.foto})`; else { ph.textContent = inisyal(b.non); ph.style.background = bg; ph.style.color = fg; }
    d.querySelector(".nm").textContent = b.non || "";
    d.querySelector(".fn").textContent = b.kind === "patisipan" ? (b.tip ? "Tikè " + b.tip : "") : (b.fonksyon || "Ekip Atelye AI");
    d.querySelector(".sg small").textContent = (b.kind === "patisipan" ? b.numero : b.badj) || "";
    const rl = d.querySelector(".rl"); rl.textContent = ROL[k]; rl.style.background = bg; rl.style.color = fg;
    qr(d.querySelector("canvas"), lyen(b));
    return d;
  }

  // same badge as a PNG (680 x 1083), for the gallery or to print
  async function imaj(b) {
    const W = 680, H = 1083, u = W / 100, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
    const k = kle(b), [bg, fg] = KOU[k], F = (w, px) => `${w} ${px}px Inter, system-ui, sans-serif`;
    g.save(); g.beginPath(); g.roundRect(0, 0, W, H, 7 * u); g.clip();
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const hh = H * 0.31; g.fillStyle = "#0f0f0f"; g.fillRect(0, 0, W, hh);
    const rg = g.createRadialGradient(W - 17 * u, 25 * u, 0, W - 17 * u, 25 * u, 35 * u); rg.addColorStop(0, "rgba(215,255,58,.35)"); rg.addColorStop(1, "rgba(215,255,58,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, hh);
    const lg = g.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, "#d7ff3a"); lg.addColorStop(.5, "#ffc83d"); lg.addColorStop(1, "#f97316"); g.fillStyle = lg; g.fillRect(0, hh - 1.6 * u, W, 1.6 * u);
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(W / 2 - 9 * u, 3.2 * u, 18 * u, 3.4 * u, 2 * u); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(7 * u, 9 * u, 15 * u, 12 * u, 3 * u); g.fill();
    const lo = await img("/logo.png"); if (lo) { const w = 11.5 * u, h = w * lo.naturalHeight / lo.naturalWidth; g.drawImage(lo, 14.5 * u - w / 2, 15 * u - h / 2, w, h); }
    g.textAlign = "right"; g.fillStyle = "#d7ff3a"; g.font = F(800, 4.1 * u); g.fillText("A T E L Y E   K O N F E R A N S", W - 7 * u, 13 * u);
    g.fillStyle = "#cfcfcf"; g.font = F(600, 3.5 * u); g.fillText(dat(b.evenement), W - 7 * u, 18.5 * u); g.fillText("Lise Anacaona · Leyogàn", W - 7 * u, 23.5 * u);
    const pw = 40 * u, ph = pw * 5 / 4, px = W / 2 - pw / 2, py = hh - 15 * u;
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(px - 1.6 * u, py - 1.6 * u, pw + 3.2 * u, ph + 3.2 * u, 7 * u); g.fill();
    g.save(); g.beginPath(); g.roundRect(px, py, pw, ph, 6 * u); g.clip();
    const ft = b.foto ? await img(`data:image/jpeg;base64,${b.foto}`) : null;
    if (ft) { const r = pw / ph, sr = ft.width / ft.height; let sw = ft.width, sh = ft.height; if (sr > r) sw = sh * r; else sh = sw / r; g.drawImage(ft, (ft.width - sw) / 2, (ft.height - sh) / 2, sw, sh, px, py, pw, ph); }
    else { g.fillStyle = bg; g.fillRect(px, py, pw, ph); g.fillStyle = fg; g.font = F(800, 15 * u); g.textAlign = "center"; g.fillText(inisyal(b.non), W / 2, py + ph / 2 + 5 * u); }
    g.restore();
    g.textAlign = "center"; g.fillStyle = "#111"; g.font = F(800, 8.2 * u);
    let y = py + ph + 12 * u, mo = String(b.non || "").split(" "), li = "", lin = [];
    mo.forEach((w) => { const t = li ? li + " " + w : w; if (g.measureText(t).width > W - 12 * u && li) { lin.push(li); li = w; } else li = t; }); if (li) lin.push(li);
    lin.slice(0, 2).forEach((l, i) => g.fillText(l, W / 2, y + i * 8.6 * u)); y += (Math.min(lin.length, 2) - 1) * 8.6 * u;
    g.fillStyle = "#666"; g.font = F(500, 3.9 * u); g.fillText(b.kind === "patisipan" ? (b.tip ? "Tikè " + b.tip : "") : (b.fonksyon || "Ekip Atelye AI"), W / 2, y + 6.5 * u);
    const by = H * 0.87, my = y + 11 * u;
    g.strokeStyle = "#e2e2e2"; g.setLineDash([1.2 * u, 1.2 * u]); g.lineWidth = .5 * u; g.beginPath(); g.moveTo(6 * u, my); g.lineTo(W - 6 * u, my); g.stroke(); g.setLineDash([]);
    const qs = 25 * u, qy = my + (by - my - qs) / 2, q = document.createElement("canvas"); q.width = q.height = 300; qr(q, lyen(b)); g.drawImage(q, 6 * u, qy, qs, qs);
    g.textAlign = "left"; g.font = F(800, 5.6 * u); SLOGAN.forEach((s, i) => { g.fillStyle = i === 2 ? "#f97316" : "#111"; g.fillText(s, 35 * u, qy + 6 * u + i * 6 * u); });
    g.fillStyle = "#999"; g.font = F(700, 3.2 * u); g.fillText(((b.kind === "patisipan" ? b.numero : b.badj) || "").split("").join(" "), 35 * u, qy + 23 * u);
    g.fillStyle = bg; g.fillRect(0, by, W, H - by); g.fillStyle = fg; g.textAlign = "center"; g.font = F(800, 6.4 * u);
    g.fillText(ROL[k].toUpperCase().split("").join(" "), W / 2, by + (H - by) / 2 + 2.2 * u);
    g.restore();
    return c;
  }

  window.BADJ = { rann, imaj, ROL };
})();
