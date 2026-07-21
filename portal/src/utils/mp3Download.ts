import { API_BASE } from '../config'
import type { Mp3Track } from '../types'

function safeFilename(name: string, fallbackExt = 'mp3') {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()
  if (!cleaned) return `track.${fallbackExt}`
  return cleaned.toLowerCase().endsWith(`.${fallbackExt}`)
    ? cleaned
    : `${cleaned}.${fallbackExt}`
}

/** Download one track as .mp3 (fetch → blob so filename is correct cross-origin). */
export async function downloadTrackMp3(track: Mp3Track): Promise<void> {
  const res = await fetch(track.publicUrl)
  if (!res.ok) throw new Error(`Tải thất bại (${res.status})`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeFilename(track.filename || track.title)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Stream folder zip from API (large folders — browser saves directly). */
export function downloadFolderZip(folderPath: string): void {
  const folder = folderPath.endsWith('/') ? folderPath : `${folderPath}/`
  const url = `${API_BASE}/mp3/folders/zip?folder=${encodeURIComponent(folder)}`
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function folderDisplayName(folderPath: string): string {
  const parts = folderPath.replace(/\/+$/, '').split('/').filter(Boolean)
  return parts[parts.length - 1] || folderPath || 'Thư mục'
}
