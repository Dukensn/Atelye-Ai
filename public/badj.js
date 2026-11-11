// Team badge, worn on a lanyard at workshops and conferences. One canvas drawing is both the preview and the PNG download.
// Three looks: "tek" (dark, faint AI network in the background), "klasik" (white with a dark header), "minimal" (all white).
// The title on the badge is the job the admins give the member (Fòmatè, Sekretè…), never the access role.
(() => {
  const SIT = "atelye-ai.vercel.app";
  const MODEL = [["tek", "Teknoloji"], ["klasik", "Klasik"], ["minimal", "Minimal"]];
  const ACC = "#d7ff3a", ACC2 = "#ffc83d";
  const inisyal = (n) => String(n || "?").split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const id = (c) => String(c || "").replace(/(.{4})(?=.)/g, "$1-");
  const tit = (b) => (b.fonksyon || "").trim() || "Ekip Atelye AI";
  const img = (src) => new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  // deterministic pseudo-random, so the background is the same on every render
  const rnd = (s) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  function qr(txt, px) {
    const q = qrcode(0, "M"); q.addData(txt); q.make();
    const n = q.getModuleCount(), c = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d"), s = px / (n + 2);
    g.fillStyle = "#fff"; g.fillRect(0, 0, px, px); g.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(Math.floor((k + 1) * s), Math.floor((r + 1) * s), Math.ceil(s), Math.ceil(s));
    return c;
  }
  // faint "neural network": nodes and links, plus a few circuit traces
  function rezo(g, x, y, w, h, col, a, seed) {
    const R = rnd(seed), N = 34, P = [];
    for (let i = 0; i < N; i++) P.push([x + R() * w, y + R() * h]);
    g.save(); g.globalAlpha = a; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, w / 420);
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d < w * 0.23) { g.beginPath(); g.moveTo(...P[i]); g.lineTo(...P[j]); g.stroke(); } }
    P.forEach(([px, py], i) => { g.beginPath(); g.arc(px, py, (i % 5 === 0 ? 3.2 : 1.8) * w / 680, 0, 7); g.fill(); });
    for (let k = 0; k < 6; k++) { let px = x + R() * w, py = y + R() * h; g.beginPath(); g.moveTo(px, py);
      for (let s = 0; s < 3; s++) { if (s % 2) py += (R() - .5) * h * .3; else px += (R() - .5) * w * .4; g.lineTo(px, py); } g.stroke(); g.beginPath(); g.arc(px, py, 3 * w / 680, 0, 7); g.stroke(); }
    g.restore();
  }
  function rond(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function koupe(g, t, max) { let s = String(t); while (s.length > 1 && g.measureText(s).width > max) s = s.slice(0, -2) + "…"; return s; }
  function liy(g, t, max) { const W = String(t || "").split(" "), L = []; let li = "";
    W.forEach((w) => { const x = li ? li + " " + w : w; if (g.measureText(x).width > max && li) { L.push(li); li = w; } else li = x; }); if (li) L.push(li); return L.slice(0, 2); }
  function foto(g, ft, x, y, w, h, r, b, fond, kl) {
    g.save(); rond(g, x, y, w, h, r); g.clip();
    if (ft) { const rt = w / h, sr = ft.width / ft.height; let sw = ft.width, sh = ft.height; if (sr > rt) sw = sh * rt; else sh = sw / rt; g.drawImage(ft, (ft.width - sw) / 2, (ft.height - sh) / 2, sw, sh, x, y, w, h); }
    else { g.fillStyle = fond; g.fillRect(x, y, w, h); g.fillStyle = kl; g.font = `700 ${w * 0.32}px Inter, system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(inisyal(b.non), x + w / 2, y + h / 2); }
    g.restore();
  }

  // b: { non, fonksyon, foto, badj }, o: "v" portrait (680x1083) | "h" landscape (1083x680), m: model
  async function desen(b, o = "v", m = "tek") {
    const H0 = o === "h", W = H0 ? 1083 : 680, H = H0 ? 680 : 1083, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const [lo, ft] = await Promise.all([img("/logo.png"), img(b.foto ? `data:image/jpeg;base64,${b.foto}` : null)]);
    const F = (w, px) => `${w} ${px}px Inter, system-ui, sans-serif`, u = Math.min(W, H) / 100;
    const nuit = m === "tek", ink = nuit ? "#fff" : "#111", mu = nuit ? "rgba(255,255,255,.62)" : "#6b6b6b";
    g.save(); rond(g, 0, 0, W, H, 5 * u); g.clip();
    // background
    if (nuit) { const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#0b0f17"); bg.addColorStop(1, "#141a26"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const gl = g.createRadialGradient(W * .85, H * .1, 0, W * .85, H * .1, W * .8); gl.addColorStop(0, "rgba(215,255,58,.16)"); gl.addColorStop(1, "rgba(215,255,58,0)"); g.fillStyle = gl; g.fillRect(0, 0, W, H);
      rezo(g, 0, 0, W, H, "#9fb4ff", .16, 7); }
    else { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); rezo(g, 0, 0, W, H, "#1e2a44", m === "minimal" ? .045 : .06, 11); }
    if (m === "klasik") { const hh = H0 ? H * .24 : H * .2; g.fillStyle = "#101010"; g.fillRect(0, 0, W, hh); rezo(g, 0, 0, W, hh, "#9fb4ff", .2, 3);
      const lg = g.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, ACC); lg.addColorStop(1, ACC2); g.fillStyle = lg; g.fillRect(0, hh - .9 * u, W, .9 * u); }
    // lanyard slot
    const slw = (H0 ? 9 : 16) * u; g.fillStyle = nuit || m === "klasik" ? "rgba(255,255,255,.92)" : "#e9e9e9"; rond(g, W / 2 - slw / 2, 2.6 * u, slw, 2.4 * u, 1.2 * u); g.fill();
    // logo: white chip on dark, plain on white
    const lgw = (H0 ? 15 : 22) * u, lgh = lo ? lgw * lo.naturalHeight / lo.naturalWidth : 0, lx = 7 * u, ly = (H0 ? 7.5 : 9) * u;
    if (lo) { if (nuit || m === "klasik") { g.fillStyle = "#fff"; rond(g, lx - 2 * u, ly - 1.6 * u, lgw + 4 * u, lgh + 3.2 * u, 2.4 * u); g.fill(); } g.drawImage(lo, lx, ly, lgw, lgh); }
    g.textAlign = "right"; g.textBaseline = "alphabetic"; g.fillStyle = nuit || m === "klasik" ? ACC : "#111"; g.font = F(800, 3.3 * u);
    g.fillText("EKIP OFISYÈL", W - 7 * u, ly + lgh * .62);
    // photo + text
    const nf = (H0 ? 7 : 8.6) * u, tf = (H0 ? 3.6 : 4.4) * u;
    let pw, ph, px, py, tx, tw, ty, al;
    if (H0) { pw = 33 * u; ph = pw * 1.18; px = 7 * u; py = H * .27; tx = px + pw + 6 * u; tw = W - tx - 7 * u; ty = py + 11 * u; al = "left"; }
    else { pw = 44 * u; ph = pw * 1.18; px = W / 2 - pw / 2; py = H * (m === "minimal" ? .2 : .24); tx = W / 2; tw = W - 14 * u; ty = py + ph + 12 * u; al = "center"; }
    if (m === "tek") { g.save(); g.shadowColor = "rgba(215,255,58,.55)"; g.shadowBlur = 5 * u; g.strokeStyle = ACC; g.lineWidth = .9 * u; rond(g, px - 1.2 * u, py - 1.2 * u, pw + 2.4 * u, ph + 2.4 * u, 5.4 * u); g.stroke(); g.restore(); }
    else if (m === "klasik") { g.fillStyle = "#fff"; rond(g, px - 1.4 * u, py - 1.4 * u, pw + 2.8 * u, ph + 2.8 * u, 5.6 * u); g.fill(); }
    foto(g, ft, px, py, pw, ph, 4.6 * u, b, nuit ? "#1f2735" : "#efefef", nuit ? "#8a96ad" : "#b5b5b5");
    g.textAlign = al; g.fillStyle = ink; g.font = F(800, nf);
    const L = liy(g, b.non || "", tw); L.forEach((l, i) => g.fillText(l, tx, ty + i * nf * 1.04)); ty += (L.length - 1) * nf * 1.04;
    // the title (job given by the admins), as a pill
    ty += tf * 1.9; g.font = F(800, tf); const t = koupe(g, tit(b).toUpperCase(), tw - 6 * u), pwd = g.measureText(t).width + 6 * u, phh = tf * 2;
    const pxl = al === "center" ? tx - pwd / 2 : tx;
    g.fillStyle = m === "minimal" ? "#111" : ACC; rond(g, pxl, ty - tf * 1.36, pwd, phh, phh / 2); g.fill();
    g.fillStyle = m === "minimal" ? "#fff" : "#111"; g.textAlign = "center"; g.fillText(t, pxl + pwd / 2, ty);
    // bottom: QR, ID, site, slogan
    const qs = (H0 ? 20 : 24) * u, by = H - qs - 7 * u, qx = H0 ? W - qs - 7 * u : 7 * u;
    if (!nuit) { g.strokeStyle = "#ececec"; g.lineWidth = .3 * u; g.beginPath(); g.moveTo(7 * u, by - 4 * u); g.lineTo(W - 7 * u, by - 4 * u); g.stroke(); }
    if (b.badj) { if (nuit) { g.fillStyle = "#fff"; rond(g, qx - 1.4 * u, by - 1.4 * u, qs + 2.8 * u, qs + 2.8 * u, 2.4 * u); g.fill(); } g.drawImage(qr(`${location.origin}/badj/${b.badj}`, 360), qx, by, qs, qs); }
    const ix = H0 ? 7 * u : qx + qs + 5 * u, fs = 3 * u; g.textAlign = "left"; let iy = by + fs * 1.5;
    if (H0) { iy = by + qs - fs * 4.4; }
    g.fillStyle = mu; g.font = F(500, fs); g.fillText("ID", ix, iy); g.fillStyle = ink; g.font = F(800, fs); g.fillText(id(b.badj), ix + 4.4 * u, iy);
    iy += fs * 1.6; g.fillStyle = mu; g.font = F(500, fs); g.fillText(SIT, ix, iy);
    iy += fs * 2.1; g.font = F(800, fs * 1.32); let sx = ix;
    [["Kreye.", ink], ["Vann.", ink], ["Otomatize.", nuit ? ACC : "#e2701f"]].forEach(([s, k]) => { g.fillStyle = k; g.fillText(s, sx, iy); sx += g.measureText(s + " ").width; });
    g.restore();
    return c;
  }

  // preview element: the drawing itself (fills in once the logo and photo are loaded)
  function rann(b, o = "v", m = "tek") {
    const d = document.createElement("div"); d.className = "bj2" + (o === "h" ? " h" : "");
    d.style.cssText = `width:${o === "h" ? 520 : 320}px;max-width:100%;aspect-ratio:${o === "h" ? "1083/680" : "680/1083"};margin:0 auto;border-radius:16px;overflow:hidden;background:#f1f1f1`;
    desen(b, o, m).then((c) => { c.style.cssText = "display:block;width:100%;height:100%"; c.setAttribute("role", "img"); c.setAttribute("aria-label", `Badj ${b.non || ""}, ${tit(b)}`); d.replaceChildren(c); });
    return d;
  }
  const imaj = (b, o = "v", m = "tek") => desen(b, o, m);

  window.BADJ = { rann, imaj, MODEL };
})();
