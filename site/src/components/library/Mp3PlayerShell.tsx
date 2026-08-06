"use client";

import type { ReactNode } from "react";
import { Mp3MiniPlayer } from "./Mp3MiniPlayer";
import { ToastProvider } from "../ui/ToastProvider";

/** Global Howler player + floating mini player (portal parity). */
export function Mp3PlayerShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <Mp3MiniPlayer />
    </ToastProvider>
  );
}
