"use client";

import { useEffect, useState } from "react";
import { PWA_APP_NAME } from "../lib/seo";

const DISMISS_KEY = "tosuthien-pwa-dismiss";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setDeferred(null);
      setDismissed();
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="border-t border-white/10 bg-[#612200] px-4 py-4 text-[#F7F2F0]"
      role="dialog"
      aria-label={`Cài đặt ứng dụng ${PWA_APP_NAME}`}
    >
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Cài {PWA_APP_NAME}</p>
          <p className="text-sm font-normal opacity-85">
            Mở như app trên máy tính / điện thoại
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="cursor-pointer px-3 py-2 text-sm opacity-80 transition hover:opacity-100"
            onClick={() => {
              setDismissed();
              setVisible(false);
            }}
          >
            Để sau
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-full bg-[#F7F2F0] px-4 py-2 text-sm font-semibold text-[#612200] transition hover:bg-white"
            onClick={async () => {
              if (!deferred) return;
              await deferred.prompt();
              try {
                await deferred.userChoice;
              } catch {
                /* ignore */
              }
              setDeferred(null);
              setDismissed();
              setVisible(false);
            }}
          >
            Cài đặt
          </button>
        </div>
      </div>
    </div>
  );
}
