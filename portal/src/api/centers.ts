import http from './http'
import { API_ORIGIN } from '../config'
import type { Center, CenterRegion } from '../types'

export async function listCenters(region?: CenterRegion): Promise<Center[]> {
  const { data } = await http.get<Center[]>('/centers', {
    params: region ? { region } : undefined,
  })
  return data
}

export async function getCenter(id: string): Promise<Center> {
  const { data } = await http.get<Center>(`/centers/${id}`)
  return data
}

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`
  return `${API_ORIGIN}/files/${url.replace(/^files\//, '')}`
}
