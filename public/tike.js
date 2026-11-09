// One look per ticket type, shared by the workshop page (sample tickets), /enskri and the real ticket (/billet).
(() => {
  const tem = (nom) => {
    const n = String(nom || "").toLowerCase();
    if (/vip/.test(n)) return { k: "vip", hd: "#16120a", tx: "#ffc83d", sub: "#fff", ac: "#ffc83d", bd: "#ffc83d" };
    if (/l[eè]ve|bon[eè]/.test(n)) return { k: "lb", hd: "#d7ff3a", tx: "#111", sub: "#111", ac: "#111", bd: "#d7ff3a" };
    return { k: "std", hd: "#0f0f0f", tx: "#d7ff3a", sub: "#fff", ac: "#d7ff3a", bd: "#e6e6e6" };
  };

  function qr(c, txt) {
    if (!window.qrcode) return;
    const q = qrcode(0, "M"); q.addData(txt); q.make();
    const n = q.getModuleCount(), m = 2, s = Math.floor(c.width / (n + 2 * m)), o = Math.floor((c.width - s * n) / 2), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(o + k * s, o + r * s, s, s);
  }

  const css = `
  .tkm { position: relative; border-radius: 16px; overflow: hidden; background: #fff; border: 2px solid var(--bd); box-shadow: 0 8px 24px rgba(0,0,0,.08); color: #111; text-align: left; }
  .tkm .h { background: var(--hd); padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .tkm .h small { display: block; color: var(--tx); font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .tkm .h b { display: block; color: var(--sub); font-size: 15px; line-height: 1.2; margin-top: 3px; }
  .tkm .h .lo { flex: none; width: 44px; height: 36px; border-radius: 9px; background: #fff; display: grid; place-items: center; }
  .tkm .h .lo img { width: 34px; height: auto; }
  .tkm .b { display: flex; gap: 12px; padding: 12px 14px; align-items: center; border-top: 2px dashed #e4e4e4; }
  .tkm canvas { flex: none; width: 92px; height: 92px; image-rendering: pixelated; }
  .tkm .num { font-size: 20px; font-weight: 800; letter-spacing: .05em; }
  .tkm dl { margin: 4px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 1px 8px; font-size: 12px; }
  .tkm dt { color: #777; } .tkm dd { margin: 0; font-weight: 600; }
  .tkm .md { position: absolute; left: 22px; bottom: 16px; rotate: -10deg; border: 2px solid #e5484d; color: #e5484d; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: .14em; padding: 2px 8px; background: rgba(255,255,255,.85); }
  .tkm.vip .b { background: linear-gradient(180deg, #fffaf0, #fff); }`;
  let mete = false;
  function stil() { if (mete) return; mete = true; const s = document.createElement("style"); s.textContent = css; document.head.append(s); }

  // sample ticket for a type: same layout as the real one, with "MODÈL" across it
  function modèl(t, evt = {}) {
    stil();
    const T = tem(t.nom), d = document.createElement("div");
    d.className = "tkm " + T.k;
    Object.entries({ hd: T.hd, tx: T.tx, sub: T.sub, bd: T.bd }).forEach(([k, v]) => d.style.setProperty("--" + k, v));
    d.innerHTML = `<div class="h"><div><small></small><b></b></div><span class="lo"><img src="/logo.png" alt=""></span></div>
      <div class="b"><canvas width="184" height="184" aria-hidden="true"></canvas><div><div class="num">AT-0000</div>
      <dl><dt>Non</dt><dd>Non ou</dd><dt>Dat</dt><dd class="dt"></dd><dt>Kote</dt><dd class="kt"></dd></dl></div></div><span class="md">MODÈL</span>`;
    d.querySelector("small").textContent = "Tikè antre · " + t.nom;
    d.querySelector(".h b").textContent = evt.nom || "Atelye konferans Atelye AI";
    d.querySelector(".dt").textContent = evt.date && window.SB ? SB.dat(evt.date, { weekday: "short", day: "numeric", month: "long" }) + " · " + SB.dat(evt.date, { hour: "2-digit", minute: "2-digit" }) : "Samdi 28 novanm · 10:00";
    d.querySelector(".kt").textContent = evt.lieu || "Lise Anacaona, Leyogàn";
    qr(d.querySelector("canvas"), "MODEL-" + T.k.toUpperCase());
    return d;
  }

  window.TIKE = { tem, qr, modèl };
})();
