// Permanent team badge (team members and helpers), portrait or landscape, worn on a lanyard.
// No event date: it shows the role colour band, job, badge ID, "member since" and a QR that opens /badj/<code>.
(() => {
  const ROL = { admin: "Super admin", validateur: "Validatè", vandeur: "Vandè", scanneur: "Eskanè", asistan: "Asistan" };
  const KOU = { admin: ["#ffc83d", "#111"], validateur: ["#3b82f6", "#fff"], vandeur: ["#22c55e", "#fff"], scanneur: ["#f97316", "#fff"], asistan: ["#a855f7", "#fff"] };
  const SLOGAN = ["Kreye.", "Vann.", "Otomatize."];
  const SIT = "atelye-ai.vercel.app";
  const css = `
  .bj2 { width: 340px; max-width: 100%; aspect-ratio: 54/86; margin: 0 auto; position: relative; border-radius: 24px; overflow: hidden; background: #fff; color: #111;
    font-family: Inter, system-ui, sans-serif; box-shadow: 0 18px 40px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06); display: flex; flex-direction: column; container-type: inline-size; }
  .bj2 .hd { position: relative; height: 24%; background: #0f0f0f; color: #fff; padding: 9cqw 7cqw 0; overflow: hidden; flex: none; }
  .bj2 .hd::before { content: ""; position: absolute; right: -18cqw; top: -14cqw; width: 70cqw; height: 70cqw; border-radius: 50%; background: radial-gradient(circle, rgba(215,255,58,.35), transparent 65%); }
  .bj2 .hd::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1.6cqw; background: linear-gradient(90deg, #d7ff3a, #ffc83d, #f97316); }
  .bj2 .sl { position: absolute; left: 50%; top: 3.2cqw; width: 18cqw; height: 3.4cqw; margin-left: -9cqw; border-radius: 2cqw; background: #fff; box-shadow: inset 0 1px 3px rgba(0,0,0,.5); }
  .bj2 .br { position: relative; display: flex; justify-content: space-between; align-items: center; gap: 3cqw; }
  .bj2 .lo { flex: none; width: 15cqw; height: 12cqw; border-radius: 3cqw; background: #fff; display: grid; place-items: center; overflow: hidden; } .bj2 .lo img { display: block; width: 76%; height: auto; max-width: none; }
  .bj2 .ev { text-align: right; } .bj2 .ev b { display: block; font-size: 5.6cqw; font-weight: 800; letter-spacing: .12em; color: #d7ff3a; }
  .bj2 .ev span { display: block; font-size: 3.5cqw; font-weight: 700; color: #cfcfcf; margin-top: 1cqw; letter-spacing: .18em; text-transform: uppercase; }
  .bj2 .ph { position: relative; z-index: 1; flex: none; width: 40cqw; aspect-ratio: 4/5; margin: -9cqw auto 0; border-radius: 6cqw; border: 1.6cqw solid #fff; background: #eee center/cover no-repeat;
    box-shadow: 0 2cqw 6cqw rgba(0,0,0,.18); display: grid; place-items: center; font-size: 15cqw; font-weight: 800; color: #bbb; }
  .bj2 .nm { text-align: center; font-size: 8.2cqw; font-weight: 800; letter-spacing: -.02em; line-height: 1.05; margin: 4cqw 6cqw 0; overflow-wrap: anywhere; }
  .bj2 .fn { text-align: center; font-size: 4cqw; color: #555; font-weight: 600; margin: 1.6cqw 6cqw 0; min-height: 1.2em; }
  .bj2 .mi { flex: 1; display: flex; align-items: center; gap: 4cqw; margin: 3cqw 6cqw 0; padding-top: 3cqw; border-top: .5cqw dashed #e2e2e2; min-height: 0; }
  .bj2 canvas { flex: none; width: 25cqw; height: 25cqw; image-rendering: pixelated; }
  .bj2 .if { flex: 1; min-width: 0; display: grid; gap: 1.3cqw; font-size: 3.4cqw; color: #666; }
  .bj2 .if b { color: #111; font-weight: 800; letter-spacing: .06em; }
  .bj2 .sg { font-size: 4.4cqw; font-weight: 800; letter-spacing: -.01em; color: #111; margin-top: .6cqw; } .bj2 .sg i { font-style: normal; color: #f97316; }
  .bj2 .rl { flex: none; height: 12%; display: flex; align-items: center; justify-content: center; font-size: 6.4cqw; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }
  /* landscape */
  .bj2.h { width: 520px; aspect-ratio: 86/54; display: grid; grid-template-columns: 34% 1fr; grid-template-rows: 25% 1fr 15%; }
  .bj2.h .hd { grid-column: 1 / -1; height: auto; padding: 0 4.5cqw; display: flex; align-items: center; }
  .bj2.h .hd .br { width: 100%; } .bj2.h .sl { top: 1.8cqw; width: 11cqw; height: 2.1cqw; margin-left: -5.5cqw; }
  .bj2.h .lo { width: 9.5cqw; height: 7.6cqw; border-radius: 2cqw; }
  .bj2.h .ev b { font-size: 3.6cqw; } .bj2.h .ev span { font-size: 2.2cqw; }
  .bj2.h .ph { grid-row: 2; width: 24cqw; margin: -3cqw auto 0 5cqw; border-radius: 3.6cqw; border-width: 1cqw; font-size: 9cqw; align-self: start; }
  .bj2.h .bd { grid-row: 2; padding: 3cqw 4.5cqw 0 1cqw; display: flex; flex-direction: column; min-width: 0; }
  .bj2.h .nm { text-align: left; font-size: 5.4cqw; margin: 0; } .bj2.h .fn { text-align: left; font-size: 2.6cqw; margin: 1cqw 0 0; }
  .bj2.h .mi { margin: 2cqw 0 0; padding-top: 2cqw; border-top-width: .35cqw; gap: 2.6cqw; }
  .bj2.h canvas { width: 15cqw; height: 15cqw; } .bj2.h .if { font-size: 2.2cqw; gap: .8cqw; } .bj2.h .sg { font-size: 2.8cqw; }
  .bj2.h .rl { grid-column: 1 / -1; height: auto; font-size: 4cqw; }`;
  let stil = false;
  const inisyal = (n) => String(n || "?").split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const id = (c) => String(c || "").replace(/(.{4})(?=.)/g, "$1-");
  const depi = (d) => d && window.SB ? SB.dat(d, { month: "short", year: "numeric" }) : "";
  const kle = (b) => (b.role in KOU ? b.role : "asistan");

  function qr(c, txt) {
    const q = qrcode(0, "M"); q.addData(txt); q.make();
    const n = q.getModuleCount(), m = 1, s = Math.floor(c.width / (n + 2 * m)), o = Math.floor((c.width - s * n) / 2), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(o + k * s, o + r * s, s, s);
  }

  // b: { non, role, fonksyon, foto, badj, depi }   o: "v" (portrait) | "h" (landscape)
  function rann(b, o = "v") {
    if (!stil) { stil = true; const s = document.createElement("style"); s.textContent = css; document.head.append(s); }
    const k = kle(b), [bg, fg] = KOU[k], d = document.createElement("div"); d.className = "bj2" + (o === "h" ? " h" : "");
    const kò = `<div class="nm"></div><div class="fn"></div>
      <div class="mi"><canvas width="240" height="240" aria-label="Kòd QR badj la"></canvas>
        <div class="if"><span>ID <b class="i1"></b></span><span class="i2"></span><span>${SIT}</span><div class="sg">Kreye. Vann. <i>Otomatize.</i></div></div></div>`;
    d.innerHTML = `<div class="hd"><span class="sl"></span><div class="br"><span class="lo"><img src="/logo.png" alt="Atelye AI"></span>
        <div class="ev"><b>ATELYE AI</b><span>Ekip ofisyèl</span></div></div></div>
      <div class="ph"></div>${o === "h" ? `<div class="bd">${kò}</div>` : kò}<div class="rl"></div>`;
    const ph = d.querySelector(".ph");
    if (b.foto) ph.style.backgroundImage = `url(data:image/jpeg;base64,${b.foto})`; else ph.textContent = inisyal(b.non);
    d.querySelector(".nm").textContent = b.non || "";
    d.querySelector(".fn").textContent = b.fonksyon || "Ekip Atelye AI";
    d.querySelector(".i1").textContent = id(b.badj);
    d.querySelector(".i2").textContent = b.depi ? "Manm depi " + depi(b.depi) : "";
    const rl = d.querySelector(".rl"); rl.textContent = ROL[k]; rl.style.background = bg; rl.style.color = fg;
    if (b.badj) qr(d.querySelector("canvas"), `${location.origin}/badj/${b.badj}`);
    return d;
  }

  // the same badge as a PNG, to print or keep in the phone (portrait 680x1083, landscape 1083x680)
  async function imaj(b, o = "v") {
    const H0 = o === "h", W = H0 ? 1083 : 680, H = H0 ? 680 : 1083, u = W / 100, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
    const k = kle(b), [bg, fg] = KOU[k], F = (w, px) => `${w} ${px}px Inter, system-ui, sans-serif`;
    const sp = (t) => String(t).split("").join(String.fromCharCode(8202));
    g.save(); g.beginPath(); g.roundRect(0, 0, W, H, (H0 ? 4.4 : 7) * u); g.clip(); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    // header
    const hh = H * (H0 ? 0.25 : 0.24); g.fillStyle = "#0f0f0f"; g.fillRect(0, 0, W, hh);
    const rg = g.createRadialGradient(W - 17 * u, 20 * u, 0, W - 17 * u, 20 * u, 35 * u); rg.addColorStop(0, "rgba(215,255,58,.35)"); rg.addColorStop(1, "rgba(215,255,58,0)"); g.fillStyle = rg; g.fillRect(0, 0, W, hh);
    const lg = g.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, "#d7ff3a"); lg.addColorStop(.5, "#ffc83d"); lg.addColorStop(1, "#f97316"); g.fillStyle = lg; g.fillRect(0, hh - (H0 ? 1 : 1.6) * u, W, (H0 ? 1 : 1.6) * u);
    const slw = (H0 ? 11 : 18) * u, slh = (H0 ? 2.1 : 3.4) * u; g.fillStyle = "#fff"; g.beginPath(); g.roundRect(W / 2 - slw / 2, (H0 ? 1.8 : 3.2) * u, slw, slh, slh / 2); g.fill();
    const lw = (H0 ? 9.5 : 15) * u, lh = (H0 ? 7.6 : 12) * u, lx = (H0 ? 4.5 : 7) * u, ly = H0 ? hh / 2 - lh / 2 : 7 * u;
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(lx, ly, lw, lh, (H0 ? 2 : 3) * u); g.fill();
    const lo = await img("/logo.png"); if (lo) { const w = lw * 0.77, h = w * lo.naturalHeight / lo.naturalWidth; g.drawImage(lo, lx + lw / 2 - w / 2, ly + lh / 2 - h / 2, w, h); }
    g.textAlign = "right"; g.fillStyle = "#d7ff3a"; g.font = F(800, (H0 ? 3.6 : 5.6) * u); g.fillText(sp("ATELYE AI"), W - lx, ly + lh * 0.48);
    g.fillStyle = "#cfcfcf"; g.font = F(700, (H0 ? 2.2 : 3.5) * u); g.fillText(sp("EKIP OFISYÈL"), W - lx, ly + lh * 0.9);
    // photo
    const pw = (H0 ? 24 : 40) * u, ph = pw * 5 / 4, px = H0 ? 5 * u : W / 2 - pw / 2, py = hh - (H0 ? 3 : 9) * u, bw = (H0 ? 1 : 1.6) * u, br = (H0 ? 3.6 : 6) * u;
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(px - bw, py - bw, pw + 2 * bw, ph + 2 * bw, br + bw); g.fill();
    g.save(); g.beginPath(); g.roundRect(px, py, pw, ph, br); g.clip();
    const ft = b.foto ? await img(`data:image/jpeg;base64,${b.foto}`) : null;
    if (ft) { const r = pw / ph, sr = ft.width / ft.height; let sw = ft.width, sh = ft.height; if (sr > r) sw = sh * r; else sh = sw / r; g.drawImage(ft, (ft.width - sw) / 2, (ft.height - sh) / 2, sw, sh, px, py, pw, ph); }
    else { g.fillStyle = "#eee"; g.fillRect(px, py, pw, ph); g.fillStyle = "#bbb"; g.font = F(800, (H0 ? 9 : 15) * u); g.textAlign = "center"; g.fillText(inisyal(b.non), px + pw / 2, py + ph / 2 + (H0 ? 3 : 5) * u); }
    g.restore();
    // name + job
    const tx = H0 ? 34 * u + u : W / 2, tw = H0 ? W - tx - 4.5 * u : W - 12 * u, al = H0 ? "left" : "center";
    g.textAlign = al; g.fillStyle = "#111"; const nf = (H0 ? 5.4 : 8.2) * u; g.font = F(800, nf);
    let y = H0 ? hh + 3 * u + nf * 0.85 : py + ph + 12 * u, li = "", lin = [];
    String(b.non || "").split(" ").forEach((w) => { const t = li ? li + " " + w : w; if (g.measureText(t).width > tw && li) { lin.push(li); li = w; } else li = t; }); if (li) lin.push(li);
    lin.slice(0, 2).forEach((l, i) => g.fillText(l, tx, y + i * nf * 1.05)); y += (Math.min(lin.length, 2) - 1) * nf * 1.05;
    g.fillStyle = "#555"; g.font = F(600, (H0 ? 2.6 : 4) * u); y += (H0 ? 4 : 6.5) * u; g.fillText(b.fonksyon || "Ekip Atelye AI", tx, y);
    // QR + info
    const by = H * (H0 ? 0.85 : 0.88), my = y + (H0 ? 3 : 5) * u, x0 = H0 ? tx : 6 * u;
    g.strokeStyle = "#e2e2e2"; g.setLineDash([1.2 * u, 1.2 * u]); g.lineWidth = (H0 ? .35 : .5) * u; g.beginPath(); g.moveTo(x0, my); g.lineTo(W - (H0 ? 4.5 : 6) * u, my); g.stroke(); g.setLineDash([]);
    const qs = (H0 ? 15 : 25) * u, qy = my + (by - my - qs) / 2, q = document.createElement("canvas"); q.width = q.height = 300; qr(q, `${location.origin}/badj/${b.badj}`); g.drawImage(q, x0, qy, qs, qs);
    const ix = x0 + qs + (H0 ? 2.6 : 4) * u, fs = (H0 ? 2.2 : 3.4) * u, lh2 = fs * 1.55; let iy = qy + fs;
    g.textAlign = "left"; g.font = F(500, fs); g.fillStyle = "#666"; g.fillText("ID ", ix, iy); g.fillStyle = "#111"; g.font = F(800, fs); g.fillText(id(b.badj), ix + g.measureText("ID  ").width, iy);
    g.font = F(500, fs); g.fillStyle = "#666"; if (b.depi) { iy += lh2; g.fillText("Manm depi " + depi(b.depi), ix, iy); } iy += lh2; g.fillText(SIT, ix, iy);
    iy += lh2 * 1.25; g.font = F(800, (H0 ? 2.8 : 4.4) * u); let sx = ix;
    SLOGAN.forEach((s, i) => { g.fillStyle = i === 2 ? "#f97316" : "#111"; g.fillText(s, sx, iy); sx += g.measureText(s + " ").width; });
    // role band
    g.fillStyle = bg; g.fillRect(0, by, W, H - by); g.fillStyle = fg; g.textAlign = "center"; g.font = F(800, (H0 ? 4 : 6.4) * u);
    g.fillText(sp(ROL[k].toUpperCase()), W / 2, by + (H - by) / 2 + (H0 ? 1.4 : 2.2) * u);
    g.restore();
    return c;
  }

  window.BADJ = { rann, imaj, ROL };
})();
