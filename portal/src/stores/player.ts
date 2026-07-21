import { reactive, computed } from 'vue'
import type { Mp3Track } from '../types'

const state = reactive({
  queue: [] as Mp3Track[],
  index: 0,
  playing: false,
  expanded: false,
})

let audio: HTMLAudioElement | null = null

function ensureAudio() {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'metadata'
    audio.addEventListener('ended', () => {
      if (state.index >= state.queue.length - 1) return
      state.index += 1
      const t = state.queue[state.index]
      if (!audio || !t) return
      audio.src = t.publicUrl
      void audio.play()
    })
    audio.addEventListener('play', () => {
      state.playing = true
    })
    audio.addEventListener('pause', () => {
      state.playing = false
    })
  }
  return audio
}

export function usePlayer() {
  const current = computed(() => state.queue[state.index] ?? null)

  function playQueue(tracks: Mp3Track[], startIndex = 0) {
    state.queue = tracks
    state.index = startIndex
    const t = state.queue[state.index]
    if (!t) return
    const a = ensureAudio()
    a.src = t.publicUrl
    void a.play()
    state.expanded = true
  }

  function toggle() {
    const a = ensureAudio()
    if (!a.src) return
    if (a.paused) void a.play()
    else a.pause()
  }

  function next() {
    if (state.index >= state.queue.length - 1) return
    state.index += 1
    const t = state.queue[state.index]
    const a = ensureAudio()
    a.src = t.publicUrl
    void a.play()
  }

  function prev() {
    if (state.index <= 0) return
    state.index -= 1
    const t = state.queue[state.index]
    const a = ensureAudio()
    a.src = t.publicUrl
    void a.play()
  }

  function setExpanded(v: boolean) {
    state.expanded = v
  }

  return { state, current, playQueue, toggle, next, prev, setExpanded }
}
