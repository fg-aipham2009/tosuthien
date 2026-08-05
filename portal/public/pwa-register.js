(function () {
  if (!("serviceWorker" in navigator)) return;

  var deferredPrompt = null;
  var DISMISS_KEY = "tosuthien-pwa-dismiss";

  function dismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch (e) {}
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function removeBanner() {
    var el = document.getElementById("tosuthien-pwa-banner");
    if (el) el.remove();
  }

  function showBanner() {
    if (isStandalone() || dismissed() || document.getElementById("tosuthien-pwa-banner")) return;

    var bar = document.createElement("div");
    bar.id = "tosuthien-pwa-banner";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Cài đặt ứng dụng Tổ Sư Thiền");
    bar.style.cssText =
      "position:fixed;z-index:9999;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));" +
      "display:flex;gap:10px;align-items:center;justify-content:space-between;" +
      "padding:12px 14px;border-radius:14px;background:#2A1810;color:#F7F2F0;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.28);font:500 14px/1.35 system-ui,sans-serif;";

    var text = document.createElement("div");
    text.style.cssText = "flex:1;min-width:0";
    text.innerHTML =
      "<strong style='display:block;font-weight:600'>Cài Tổ Sư Thiền</strong>" +
      "<span style='opacity:.85;font-weight:400;font-size:13px'>Mở như app trên máy tính / điện thoại</span>";

    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-shrink:0";

    var later = document.createElement("button");
    later.type = "button";
    later.textContent = "Để sau";
    later.style.cssText =
      "border:0;background:transparent;color:#F7F2F0;opacity:.8;padding:8px 10px;cursor:pointer;font:inherit";
    later.addEventListener("click", function () {
      setDismissed();
      removeBanner();
    });

    var install = document.createElement("button");
    install.type = "button";
    install.textContent = "Cài đặt";
    install.style.cssText =
      "border:0;border-radius:999px;background:#F7F2F0;color:#2A1810;padding:8px 14px;cursor:pointer;font:600 13px system-ui,sans-serif";
    install.addEventListener("click", async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (e) {}
      deferredPrompt = null;
      setDismissed();
      removeBanner();
    });

    actions.appendChild(later);
    actions.appendChild(install);
    bar.appendChild(text);
    bar.appendChild(actions);
    document.body.appendChild(bar);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showBanner();
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    setDismissed();
    removeBanner();
  });

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
})();
