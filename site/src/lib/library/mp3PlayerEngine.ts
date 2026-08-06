"use client";

import { Howl } from "howler";
import type { Mp3Track } from "./types";

export type RepeatMode = "off" | "all" | "one";

export type PlayerSnapshot = {
  queue: Mp3Track[];
  index: number;
  playing: boolean;
  loading: boolean;
  visible: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string;
};

const initial: PlayerSnapshot = {
  queue: [],
  index: 0,
  playing: false,
  loading: false,
  visible: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: "off",
  error: "",
};

let state: PlayerSnapshot = { ...initial };
let howl: Howl | null = null;
let raf = 0;
let order: number[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<PlayerSnapshot>) {
  state = { ...state, ...patch };
  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlayerSnapshot(): PlayerSnapshot {
  return state;
}

function clearTick() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function tick() {
  if (!howl || !state.playing) {
    clearTick();
    return;
  }
  const pos = howl.seek();
  const position = typeof pos === "number" ? pos : 0;
  if (position !== state.position) setState({ position });
  raf = requestAnimationFrame(tick);
}

function syncMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const t = state.queue[state.index];
  if (!t || !state.visible) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: "Tổ Sư Thiền",
    album: "MP3 khai thị",
  });
  navigator.mediaSession.playbackState = state.playing ? "playing" : "paused";
}

function rebuildOrder() {
  order = state.queue.map((_, i) => i);
  if (state.shuffle) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const cur = order.indexOf(state.index);
    if (cur > 0) {
      order.splice(cur, 1);
      order.unshift(state.index);
    }
  }
}

function unload() {
  clearTick();
  if (howl) {
    howl.unload();
    howl = null;
  }
}

function loadAndPlay(index: number) {
  const track = state.queue[index];
  if (!track?.publicUrl) return;
  unload();
  setState({
    index,
    visible: true,
    loading: true,
    error: "",
    position: 0,
    duration: 0,
  });
  syncMediaSession();

  howl = new Howl({
    src: [track.publicUrl],
    html5: true,
    preload: true,
    onload: () => {
      setState({ duration: howl?.duration() || 0, loading: false });
    },
    onplay: () => {
      setState({ playing: true, loading: false });
      clearTick();
      raf = requestAnimationFrame(tick);
      syncMediaSession();
    },
    onpause: () => {
      setState({ playing: false });
      clearTick();
      syncMediaSession();
    },
    onstop: () => {
      setState({ playing: false });
      clearTick();
      syncMediaSession();
    },
    onend: () => {
      if (state.repeat === "one") {
        howl?.seek(0);
        void howl?.play();
        return;
      }
      const advanced = advance(+1);
      if (!advanced && state.repeat === "all" && state.queue.length) {
        loadAndPlay(order[0] ?? 0);
      } else if (!advanced) {
        setState({
          playing: false,
          position: state.duration || 0,
        });
        syncMediaSession();
      }
    },
    onloaderror: (_id, err) => {
      setState({
        loading: false,
        playing: false,
        error: `Không phát được: ${String(err)}`,
      });
    },
    onplayerror: (_id, err) => {
      setState({
        loading: false,
        playing: false,
        error: `Lỗi phát: ${String(err)}`,
      });
      howl?.once("unlock", () => {
        void howl?.play();
      });
    },
  });

  void howl.play();
}

function advance(delta: number): boolean {
  if (!order.length) rebuildOrder();
  const pos = order.indexOf(state.index);
  const nextPos = pos + delta;
  if (nextPos < 0 || nextPos >= order.length) return false;
  loadAndPlay(order[nextPos]);
  return true;
}

function play() {
  if (!howl) {
    if (state.queue[state.index]) loadAndPlay(state.index);
    return;
  }
  void howl.play();
}

function pause() {
  howl?.pause();
}

function seek(seconds: number) {
  if (!howl || !state.duration) return;
  const t = Math.max(0, Math.min(seconds, state.duration));
  howl.seek(t);
  setState({ position: t });
}

let mediaSessionBound = false;

function bindMediaSessionHandlers() {
  if (mediaSessionBound || typeof navigator === "undefined" || !("mediaSession" in navigator))
    return;
  mediaSessionBound = true;
  navigator.mediaSession.setActionHandler("play", () => play());
  navigator.mediaSession.setActionHandler("pause", () => pause());
  navigator.mediaSession.setActionHandler("previoustrack", () => playerPrev());
  navigator.mediaSession.setActionHandler("nexttrack", () => playerNext());
  navigator.mediaSession.setActionHandler("stop", () => stopAndClose());
  navigator.mediaSession.setActionHandler("seekto", (details) => {
    if (typeof details.seekTime === "number") seek(details.seekTime);
  });
}

export function playQueue(tracks: Mp3Track[], startIndex = 0) {
  if (!tracks.length) return;
  setState({
    queue: tracks,
    index: Math.max(0, Math.min(startIndex, tracks.length - 1)),
    visible: true,
  });
  rebuildOrder();
  bindMediaSessionHandlers();
  loadAndPlay(state.index);
}

export function togglePlay() {
  if (!howl) {
    play();
    return;
  }
  if (howl.playing()) pause();
  else play();
}

export function playerNext() {
  if (!advance(+1) && state.repeat === "all" && state.queue.length) {
    loadAndPlay(order[0] ?? 0);
  }
}

export function playerPrev() {
  const cur = typeof howl?.seek() === "number" ? (howl!.seek() as number) : 0;
  if (cur > 3) {
    howl?.seek(0);
    setState({ position: 0 });
    return;
  }
  if (!advance(-1) && state.repeat === "all" && state.queue.length) {
    loadAndPlay(order[order.length - 1] ?? 0);
  }
}

export function seekRatio(ratio: number) {
  if (!state.duration) return;
  seek(Math.max(0, Math.min(1, ratio)) * state.duration);
}

export function toggleShuffle() {
  setState({ shuffle: !state.shuffle });
  rebuildOrder();
}

export function cycleRepeat() {
  const next: RepeatMode =
    state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  setState({ repeat: next });
}

export function stopAndClose() {
  unload();
  state = { ...initial };
  order = [];
  emit();
  syncMediaSession();
}

export function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function getCurrentTrack(): Mp3Track | null {
  return state.visible ? (state.queue[state.index] ?? null) : null;
}

export function getProgress(): number {
  return state.duration > 0 ? Math.min(1, state.position / state.duration) : 0;
}

export function getQueueLabel(): string {
  if (!state.queue.length || !state.visible) return "";
  return `${state.index + 1}/${state.queue.length}`;
}

export function hasPrevTrack(): boolean {
  if (!order.length) return state.index > 0;
  return order.indexOf(state.index) > 0 || state.repeat === "all";
}

export function hasNextTrack(): boolean {
  if (!order.length) return state.index < state.queue.length - 1;
  return order.indexOf(state.index) < order.length - 1 || state.repeat === "all";
}

export function isTrackActive(trackId: string): boolean {
  const t = getCurrentTrack();
  return t?.id === trackId;
}
