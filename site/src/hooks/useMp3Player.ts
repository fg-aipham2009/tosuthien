"use client";

import { useSyncExternalStore } from "react";
import {
  cycleRepeat,
  formatTime,
  getCurrentTrack,
  getPlayerSnapshot,
  getProgress,
  getQueueLabel,
  hasNextTrack,
  hasPrevTrack,
  isTrackActive,
  playerNext,
  playerPrev,
  playQueue,
  seekRatio,
  stopAndClose,
  subscribe,
  togglePlay,
  toggleShuffle,
} from "../lib/library/mp3PlayerEngine";

export function useMp3Player() {
  const snap = useSyncExternalStore(subscribe, getPlayerSnapshot, getPlayerSnapshot);

  return {
    state: snap,
    current: getCurrentTrack(),
    progress: getProgress(),
    queueLabel: getQueueLabel(),
    hasPrev: hasPrevTrack(),
    hasNext: hasNextTrack(),
    playQueue,
    toggle: togglePlay,
    next: playerNext,
    prev: playerPrev,
    seekRatio,
    toggleShuffle,
    cycleRepeat,
    stopAndClose,
    formatTime,
    isTrackActive,
  };
}
