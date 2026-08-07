(function () {
  var deferredPrompt = null;
  var listeners = [];

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function notify() {
    var canInstall = !!(deferredPrompt && !isStandalone());
    listeners.forEach(function (fn) {
      try {
        fn(canInstall);
      } catch (e) {}
    });
    window.dispatchEvent(
      new CustomEvent("tosuthien-pwa", { detail: { canInstall: canInstall } }),
    );
  }

  /** Same behavior as old bottom "Cài đặt" banner: trigger native PWA install. */
  window.tosuthienPwa = {
    canInstall: function () {
      return !!(deferredPrompt && !isStandalone());
    },
    isStandalone: isStandalone,
    onChange: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
      // push current state immediately
      try {
        fn(!!(deferredPrompt && !isStandalone()));
      } catch (e) {}
      return function () {
        listeners = listeners.filter(function (x) {
          return x !== fn;
        });
      };
    },
    install: async function () {
      if (isStandalone()) return { ok: false, reason: "installed" };
      if (!deferredPrompt) return { ok: false, reason: "unavailable" };
      var promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      var choice = null;
      try {
        choice = await promptEvent.userChoice;
      } catch (e) {}
      notify();
      return {
        ok: true,
        outcome: choice && choice.outcome ? choice.outcome : "unknown",
      };
    },
  };

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    notify();
  });

  if ("serviceWorker" in navigator) {
    // Register ASAP so Chrome can fire beforeinstallprompt (same as old banner).
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }
})();
