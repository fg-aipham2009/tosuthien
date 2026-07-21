import { reactive, computed, readonly } from 'vue'
import { Howl } from 'howler'
import type { Mp3Track } from '../types'

export type RepeatMode = 'off' | 'all' | 'one'

const state = reactive({
  queue: [] as Mp3Track[],
  index: 0,
  playing: false,
  loading: false,
  expanded: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off' as RepeatMode,
  error: '',
})

let howl: Howl | null = null
let raf = 0
let order: number[] = []

function clearTick() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

function tick() {
  if (!howl || !state.playing) {
    clearTick()
    return
  }
  state.position = howl.seek() as number
  raf = requestAnimationFrame(tick)
}

function syncMediaSession() {
  if (!('mediaSession' in navigator)) return
  const t = state.queue[state.index]
  if (!t) {
    navigator.mediaSession.metadata = null
    return
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: 'Tổ Sư Thiền',
    album: 'MP3 khai thị',
  })
  navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused'
}

function rebuildOrder() {
  order = state.queue.map((_, i) => i)
  if (state.shuffle) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    // Keep current track first in shuffle bag.
    const cur = order.indexOf(state.index)
    if (cur > 0) {
      order.splice(cur, 1)
      order.unshift(state.index)
    }
  }
}

function unload() {
  clearTick()
  if (howl) {
    howl.unload()
    howl = null
  }
}

function loadAndPlay(index: number) {
  const track = state.queue[index]
  if (!track?.publicUrl) return
  unload()
  state.index = index
  state.loading = true
  state.error = ''
  state.position = 0
  state.duration = 0
  syncMediaSession()

  howl = new Howl({
    src: [track.publicUrl],
    html5: true, // better for long MP3 / streaming on mobile
    preload: true,
    onload: () => {
      state.duration = howl?.duration() || 0
      state.loading = false
    },
    onplay: () => {
      state.playing = true
      state.loading = false
      clearTick()
      raf = requestAnimationFrame(tick)
      syncMediaSession()
    },
    onpause: () => {
      state.playing = false
      clearTick()
      syncMediaSession()
    },
    onstop: () => {
      state.playing = false
      clearTick()
      syncMediaSession()
    },
    onend: () => {
      if (state.repeat === 'one') {
        howl?.seek(0)
        void howl?.play()
        return
      }
      const advanced = advance(+1)
      if (!advanced && state.repeat === 'all' && state.queue.length) {
        const first = order[0] ?? 0
        loadAndPlay(first)
      } else if (!advanced) {
        state.playing = false
        state.position = 0
        syncMediaSession()
      }
    },
    onloaderror: (_id, err) => {
      state.loading = false
      state.playing = false
      state.error = `Không phát được: ${String(err)}`
    },
    onplayerror: (_id, err) => {
      state.loading = false
      state.playing = false
      state.error = `Lỗi phát: ${String(err)}`
      // Unlock autoplay on some mobile browsers.
      howl?.once('unlock', () => {
        void howl?.play()
      })
    },
  })

  void howl.play()
}

function advance(delta: number): boolean {
  if (!order.length) rebuildOrder()
  const pos = order.indexOf(state.index)
  const nextPos = pos + delta
  if (nextPos < 0 || nextPos >= order.length) return false
  loadAndPlay(order[nextPos])
  return true
}

function play() {
  if (!howl) {
    if (state.queue[state.index]) loadAndPlay(state.index)
    return
  }
  void howl.play()
}

function pause() {
  howl?.pause()
}

function next() {
  if (!advance(+1) && state.repeat === 'all' && state.queue.length) {
    loadAndPlay(order[0] ?? 0)
  }
}

function prev() {
  if ((howl?.seek() as number) > 3) {
    howl?.seek(0)
    state.position = 0
    return
  }
  if (!advance(-1) && state.repeat === 'all' && state.queue.length) {
    loadAndPlay(order[order.length - 1] ?? 0)
  }
}

function seek(seconds: number) {
  if (!howl) return
  const t = Math.max(0, Math.min(seconds, state.duration || seconds))
  howl.seek(t)
  state.position = t
}

function bindMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.setActionHandler('play', () => {
    void play()
  })
  navigator.mediaSession.setActionHandler('pause', () => pause())
  navigator.mediaSession.setActionHandler('previoustrack', () => prev())
  navigator.mediaSession.setActionHandler('nexttrack', () => next())
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (typeof details.seekTime === 'number') seek(details.seekTime)
  })
}

export function usePlayer() {
  const current = computed(() => state.queue[state.index] ?? null)
  const progress = computed(() =>
    state.duration > 0 ? Math.min(1, state.position / state.duration) : 0,
  )
  const hasPrev = computed(() => {
    if (!order.length) return state.index > 0
    return order.indexOf(state.index) > 0
  })
  const hasNext = computed(() => {
    if (!order.length) return state.index < state.queue.length - 1
    return order.indexOf(state.index) < order.length - 1
  })

  function playQueue(tracks: Mp3Track[], startIndex = 0) {
    state.queue = tracks
    state.index = Math.max(0, Math.min(startIndex, tracks.length - 1))
    state.expanded = true
    rebuildOrder()
    bindMediaSessionHandlers()
    loadAndPlay(state.index)
  }

  function toggle() {
    if (!howl) {
      play()
      return
    }
    if (howl.playing()) pause()
    else play()
  }

  function seekRatio(ratio: number) {
    if (!state.duration) return
    seek(ratio * state.duration)
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle
    rebuildOrder()
  }

  function cycleRepeat() {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off'
  }

  function setExpanded(v: boolean) {
    state.expanded = v
  }

  function formatTime(sec: number) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00'
    const s = Math.floor(sec)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  return {
    state: readonly(state),
    current,
    progress,
    hasPrev,
    hasNext,
    playQueue,
    toggle,
    next,
    prev,
    seek,
    seekRatio,
    toggleShuffle,
    cycleRepeat,
    setExpanded,
    formatTime,
  }
}
