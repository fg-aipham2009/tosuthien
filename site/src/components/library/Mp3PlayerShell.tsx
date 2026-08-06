"use client";

import type { ReactNode } from "react";
import { Mp3MiniPlayer } from "./Mp3MiniPlayer";

/** Global Howler player + floating mini player (portal parity). */
export function Mp3PlayerShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Mp3MiniPlayer />
    </>
  );
}
