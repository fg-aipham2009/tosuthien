import http from './http'
import type { MediaCategory, Mp3Track } from '../types'

type CacheEntry<T> = { at: number; data: T }
const cache = new Map<string, CacheEntry<unknown>>()
const TTL_MS = 60_000

async function cachedGet<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T
  const data = await loader()
  cache.set(key, { at: Date.now(), data })
  return data
}

export async function listCategories(signal?: AbortSignal): Promise<MediaCategory[]> {
  return cachedGet('categories', async () => {
    const { data } = await http.get<MediaCategory[]>('/media/categories', { signal })
    return data
  })
}

export async function listTracks(params: {
  category?: string
  folder?: string
  year?: number
  signal?: AbortSignal
}): Promise<Mp3Track[]> {
  const { signal, ...query } = params
  const { data } = await http.get<Mp3Track[]>('/mp3/tracks', { params: query, signal })
  return data
}

/** Distinct folder paths only — no track payloads. */
export async function listFolders(params: {
  category?: string
  year?: number
  signal?: AbortSignal
}): Promise<string[]> {
  const { signal, ...query } = params
  const key = `folders:${query.category ?? ''}:${query.year ?? ''}`
  return cachedGet(key, async () => {
    const { data } = await http.get<string[]>('/mp3/folders', { params: query, signal })
    return data
  })
}

export async function listYears(params: {
  category?: string
  folder?: string
  signal?: AbortSignal
}): Promise<number[]> {
  const { signal, ...query } = params
  const key = `years:${query.category ?? ''}:${query.folder ?? ''}`
  return cachedGet(key, async () => {
    const { data } = await http.get<number[]>('/mp3/years', { params: query, signal })
    return data
  })
}
