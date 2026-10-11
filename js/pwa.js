// Meldet den Service Worker (sw.js) an und zeigt "Update verfügbar", sobald eine neue Version bereitliegt.
const hinweis = document.getElementById("update");
let wartend = null, neuLaden = false;

function zeige(worker) { wartend = worker; hinweis.hidden = false; }

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    // Ohne controller ist es die allererste Installation, also kein Update.
    if (reg.waiting && navigator.serviceWorker.controller) zeige(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const neu = reg.installing;
      if (!neu) return;
      neu.addEventListener("statechange", () => {
        if (neu.state === "installed" && navigator.serviceWorker.controller) zeige(neu);
      });
    });
    // Eine installierte App bleibt oft tagelang offen: beim Zurückholen nach einer neuen Version sehen.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
    });
  }).catch(() => {});

  document.getElementById("updateJetzt").addEventListener("click", () => {
    if (!wartend) return;
    neuLaden = true;
    wartend.postMessage("aktualisieren");
  });
  // Der neue Service Worker hat übernommen: Seite neu laden, damit sie die neuen Dateien bekommt.
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (neuLaden) location.reload(); });
}
