import http from './http'
import type { MediaCategory, Mp3Track } from '../types'

export async function listCategories(): Promise<MediaCategory[]> {
  const { data } = await http.get<MediaCategory[]>('/media/categories')
  return data
}

export async function listTracks(params: {
  category?: string
  folder?: string
  year?: number
}): Promise<Mp3Track[]> {
  const { data } = await http.get<Mp3Track[]>('/mp3/tracks', { params })
  return data
}

/** Distinct folder paths only — avoids loading every track in the album. */
export async function listFolders(params: {
  category?: string
  year?: number
}): Promise<string[]> {
  const { data } = await http.get<string[]>('/mp3/folders', { params })
  return data
}

export async function listYears(params: {
  category?: string
  folder?: string
}): Promise<number[]> {
  const { data } = await http.get<number[]>('/mp3/years', { params })
  return data
}
