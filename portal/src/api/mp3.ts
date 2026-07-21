import http from './http'
import type { MediaCategory, Mp3Track } from '../types'

export async function listCategories(): Promise<MediaCategory[]> {
  const { data } = await http.get<MediaCategory[]>('/media/categories')
  return data
}

export async function listTracks(params: {
  category?: string
  folder?: string
}): Promise<Mp3Track[]> {
  const { data } = await http.get<Mp3Track[]>('/mp3/tracks', { params })
  return data
}
