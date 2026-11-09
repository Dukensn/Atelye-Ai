// Team badge: photo, name, job, role and a QR that opens /badj/<code> to check it at the door.
(() => {
  const ROL = { admin: "Super admin", validateur: "Validatè", vandeur: "Vandè", scanneur: "Eskanè" };
  const css = `
  .bj { max-width: 340px; margin: 0 auto; background: #fff; border-radius: 22px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,.12); text-align: center; color: #111; }
  .bj .h { background: #111; color: #fff; padding: 14px 18px 46px; display: flex; justify-content: space-between; align-items: center; }
  .bj .h small { font-size: 11px; font-weight: 800; letter-spacing: .12em; color: #ffc83d; }
  .bj .h .lo { width: 44px; height: 34px; border-radius: 8px; background: #fff; display: grid; place-items: center; } .bj .h .lo img { width: 34px; }
  .bj .ph { width: 132px; height: 132px; border-radius: 50%; margin: -40px auto 0; border: 5px solid #fff; background: #f1f1f1 center/cover no-repeat; box-shadow: 0 4px 14px rgba(0,0,0,.15); display: grid; place-items: center; font-size: 46px; font-weight: 800; color: #bbb; }
  .bj .nm { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin: 12px 16px 2px; }
  .bj .fn { font-size: 14px; color: #666; margin: 0 16px; min-height: 1em; }
  .bj .rl { display: inline-block; margin: 10px 0 4px; padding: 5px 12px; border-radius: 999px; background: #ffc83d; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .bj canvas { width: 150px; height: 150px; image-rendering: pixelated; margin: 10px auto 2px; display: block; }
  .bj .cd { font-size: 13px; font-weight: 700; letter-spacing: .12em; color: #888; }
  .bj .ev { margin-top: 12px; padding: 10px 14px 14px; border-top: 2px dashed #eee; font-size: 13px; color: #555; }`;
  let stil = false;
  const evTxt = (e) => e ? `${e.nom} · ${window.SB ? SB.dat(e.date, { day: "numeric", month: "long", year: "numeric" }) : ""} · ${e.lieu || ""}` : "Atelye AI";
  const inisyal = (n) => String(n || "?").split(/\s+/).map((x) => x[0] || "").join("").slice(0, 2).toUpperCase();

  function qr(c, txt) {
    const q = qrcode(0, "M"); q.addData(txt); q.make();
    const n = q.getModuleCount(), m = 2, s = Math.floor(c.width / (n + 2 * m)), o = Math.floor((c.width - s * n) / 2), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(o + k * s, o + r * s, s, s);
  }

  function rann(b) {
    if (!stil) { stil = true; const s = document.createElement("style"); s.textContent = css; document.head.append(s); }
    const d = document.createElement("div"); d.className = "bj";
    d.innerHTML = `<div class="h"><small>EKIP · ATELYE AI</small><span class="lo"><img src="/logo.png" alt=""></span></div>
      <div class="ph"></div><div class="nm"></div><div class="fn"></div><span class="rl"></span>
      <canvas width="300" height="300" aria-label="Kòd QR badj la"></canvas><div class="cd"></div><div class="ev"></div>`;
    const ph = d.querySelector(".ph");
    if (b.foto) ph.style.backgroundImage = `url(data:image/jpeg;base64,${b.foto})`; else ph.textContent = inisyal(b.non);
    d.querySelector(".nm").textContent = b.non || "";
    d.querySelector(".fn").textContent = b.fonksyon || "";
    d.querySelector(".rl").textContent = ROL[b.role] || "An atant";
    d.querySelector(".cd").textContent = b.badj || "";
    d.querySelector(".ev").textContent = evTxt(b.evenement);
    if (b.badj) qr(d.querySelector("canvas"), `${location.origin}/badj/${b.badj}`);
    return d;
  }

  // the same badge as one PNG for the phone's gallery
  async function imaj(b) {
    const W = 640, H = 1000, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.fillStyle = "#111"; g.fillRect(0, 0, W, 210);
    g.fillStyle = "#ffc83d"; g.font = "800 26px Inter, sans-serif"; g.fillText("EKIP · ATELYE AI", 40, 70);
    const lo = await img("/logo.png"); if (lo) { g.fillStyle = "#fff"; g.beginPath(); g.roundRect(W - 140, 34, 100, 76, 14); g.fill(); g.drawImage(lo, W - 130, 72 - 40 * lo.naturalHeight / lo.naturalWidth, 80, 80 * lo.naturalHeight / lo.naturalWidth); }
    g.save(); g.beginPath(); g.arc(W / 2, 250, 120, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.beginPath(); g.arc(W / 2, 250, 108, 0, Math.PI * 2); g.clip();
    const ft = b.foto ? await img(`data:image/jpeg;base64,${b.foto}`) : null;
    if (ft) { const s = Math.min(ft.width, ft.height); g.drawImage(ft, (ft.width - s) / 2, (ft.height - s) / 2, s, s, W / 2 - 108, 142, 216, 216); }
    else { g.fillStyle = "#eee"; g.fillRect(W / 2 - 108, 142, 216, 216); g.fillStyle = "#aaa"; g.font = "800 80px Inter, sans-serif"; g.textAlign = "center"; g.fillText(inisyal(b.non), W / 2, 280); }
    g.restore(); g.textAlign = "center";
    g.fillStyle = "#111"; g.font = "800 44px Inter, sans-serif"; g.fillText(b.non || "", W / 2, 430);
    g.fillStyle = "#666"; g.font = "600 26px Inter, sans-serif"; g.fillText(b.fonksyon || "", W / 2, 474);
    const rl = (ROL[b.role] || "").toUpperCase(); g.font = "800 22px Inter, sans-serif"; const w = g.measureText(rl).width + 40;
    g.fillStyle = "#ffc83d"; g.beginPath(); g.roundRect(W / 2 - w / 2, 498, w, 44, 22); g.fill(); g.fillStyle = "#111"; g.fillText(rl, W / 2, 528);
    const q = document.createElement("canvas"); q.width = q.height = 300; qr(q, `${location.origin}/badj/${b.badj}`); g.drawImage(q, W / 2 - 150, 566, 300, 300);
    g.fillStyle = "#888"; g.font = "700 24px Inter, sans-serif"; g.fillText(b.badj || "", W / 2, 900);
    g.fillStyle = "#555"; g.font = "600 20px Inter, sans-serif"; g.fillText(evTxt(b.evenement).slice(0, 60), W / 2, 950);
    return c;
  }

  window.BADJ = { rann, imaj, ROL };
})();
