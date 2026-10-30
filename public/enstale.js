// Install button for the Atelye AI app (PWA) + service worker registration.
// Any element with [data-enstale] becomes the install button; it disappears once the app is installed.
(() => {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

  const mem = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const anApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let pwomt = null;

  if (anApp()) mem.set("atelier-enstale", "1");
  const enstale = () => anApp() || mem.get("atelier-enstale") === "1";

  function mete() {
    document.querySelectorAll("[data-enstale]").forEach((b) => {
      const montre = !enstale() && (pwomt || ios);
      b.classList.toggle("hidden", !montre);
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pwomt = e; mete(); });
  window.addEventListener("appinstalled", () => { mem.set("atelier-enstale", "1"); pwomt = null; mete(); });

  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-enstale]");
    if (!b) return;
    if (pwomt) {
      pwomt.prompt();
      const { outcome } = await pwomt.userChoice;
      if (outcome === "accepted") mem.set("atelier-enstale", "1");
      pwomt = null; mete();
    } else if (ios) {
      alert("Pou enstale app la sou iPhone:\n\n1. Peze bouton Pataje a (kare ak flèch anlè) anba ekran an.\n2. Chwazi « Sur l'écran d'accueil » / « Add to Home Screen ».\n3. Peze « Ajouter ».");
    }
  });

  window.Enstale = { mete, anApp, enstale };
  document.addEventListener("DOMContentLoaded", mete);
  mete();
})();
