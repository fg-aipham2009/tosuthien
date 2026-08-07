(function () {
  if (!("serviceWorker" in navigator)) return;

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

  window.tosuthienPwa = {
    canInstall: function () {
      return !!(deferredPrompt && !isStandalone());
    },
    onChange: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (x) {
          return x !== fn;
        });
      };
    },
    install: async function () {
      if (!deferredPrompt || isStandalone()) return false;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (e) {}
      deferredPrompt = null;
      notify();
      return true;
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

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
})();
