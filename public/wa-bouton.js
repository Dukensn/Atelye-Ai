// Floating "write us on WhatsApp" button for the public pages. One file, one number to change.
(() => {
  const NIMEWO = "50938649724";
  const p = location.pathname;
  const tèks = p.startsWith("/enskri") ? "Bonjou! M ap enskri pou atelye Atelye AI a, m gen yon kesyon."
    : p.startsWith("/billet") ? "Bonjou! M gen yon kesyon sou tikè mwen."
    : p.startsWith("/konferans") ? "Bonjou! M wè atelye Atelye AI a, m ta renmen plis enfòmasyon."
    : "Bonjou Atelye AI! M ta renmen plis enfòmasyon.";
  const a = document.createElement("a");
  a.href = `https://wa.me/${NIMEWO}?text=${encodeURIComponent(tèks)}`;
  a.target = "_blank"; a.rel = "noopener"; a.className = "wa-fl"; a.setAttribute("aria-label", "Ekri nou sou WhatsApp");
  a.innerHTML = '<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path fill="#fff" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.3c-2.1 0-4.1-.6-5.9-1.6l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.7C5.1 10 10 5.3 16 5.3S26.9 10 26.9 15.8 22 26.3 16 26.3zm6-7.8c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg><span>Ekri nou</span>';
  const s = document.createElement("style");
  s.textContent = `.wa-fl{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:8px;padding:12px 16px 12px 13px;border-radius:999px;background:#25d366;color:#fff;font:600 15px/1 Inter,system-ui,sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.22);transition:transform .15s}
.wa-fl:hover{transform:translateY(-2px)}.wa-fl:focus-visible{outline:3px solid #3b82f6;outline-offset:3px}
@media (max-width:600px){.wa-fl span{display:none}.wa-fl{padding:13px}}
@media print{.wa-fl{display:none}}`;
  const mete = () => { document.head.append(s); document.body.append(a); };
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", mete) : mete();
})();
