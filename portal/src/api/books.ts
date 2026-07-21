import http from './http'
import { getDeviceId } from '../lib/device'
import type { BookPdf, TextBook, TextBookPage } from '../types'

export async function listPdfs(): Promise<BookPdf[]> {
  const { data } = await http.get<BookPdf[]>('/pdfs', {
    params: { device_id: getDeviceId() },
  })
  return data
}

export async function listTextBooks(): Promise<TextBook[]> {
  const { data } = await http.get<TextBook[]>('/text-books', {
    params: { device_id: getDeviceId() },
  })
  return data
}

export async function fetchTextPages(
  id: string,
  from: number,
  to: number,
): Promise<{ pageCount: number; pages: TextBookPage[]; title: string }> {
  const { data } = await http.get(`/text-books/${id}/pages`, {
    params: { from, to },
  })
  return data
}

export async function saveReadingProgress(pdfFileId: string, lastPage: number) {
  await http.put('/reading-progress', {
    deviceId: getDeviceId(),
    pdfFileId,
    lastPage,
  })
}
