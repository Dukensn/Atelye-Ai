// Supabase "Levve dijital": the site only calls server functions (RPC) with the public key.
// Tables are private (RLS on, no policy); validation and tickets are created server-side only.
window.SB = (() => {
  const URL_ = "https://ojbbempzypxmhkpmyseo.supabase.co";
  const KLE = "sb_publishable_Vg6ndCnLHvya5ytT5lIyKw_YyRoe2f0";
  async function rpc(fn, args = {}) {
    let r;
    try {
      r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KLE, "content-type": "application/json" }, body: JSON.stringify(args) });
    } catch { throw new Error("Pa gen entènèt. Eseye ankò."); }
    const t = await r.text();
    const d = t ? JSON.parse(t) : null;
    if (!r.ok) throw new Error((d && (d.message || d.hint)) || "Gen yon pwoblèm. Eseye ankò.");
    return d;
  }
  const goud = (n) => Number(n).toLocaleString("fr-FR") + " goud";
  const dola = (n) => (n == null ? "" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " $");
  // dates in Kreyòl, Haiti time
  const JOU = ["Dimanch", "Lendi", "Madi", "Mèkredi", "Jedi", "Vandredi", "Samdi"];
  const MWA = ["janvye", "fevriye", "mas", "avril", "me", "jen", "jiyè", "out", "septanm", "oktòb", "novanm", "desanm"];
  const dat = (iso, o = {}) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Port-au-Prince", year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)), le = `${p.hour}:${p.minute}`;
    const tout = [o.weekday && JOU[d.getUTCDay()], (o.day || o.month) && `${+p.day} ${MWA[+p.month - 1]}`, o.year && p.year].filter(Boolean).join(" ");
    if (o.dateStyle) return `${+p.day}/${+p.month} ${le}`;
    if (o.hour || o.timeStyle) return tout ? `${tout} · ${le}` : le;
    return tout || `${+p.day} ${MWA[+p.month - 1]} ${p.year}`;
  };
  return { rpc, goud, dola, dat };
})();
