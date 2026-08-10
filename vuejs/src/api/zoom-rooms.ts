import http from './http';
import type { ZoomRoom, ZoomRoomFormData } from '@/types/models';

export async function fetchZoomRooms(all = true): Promise<ZoomRoom[]> {
  const { data } = await http.get<ZoomRoom[]>('/zoom-rooms', {
    params: { all: all ? 'true' : undefined },
  });
  return data;
}

export async function createZoomRoom(payload: ZoomRoomFormData): Promise<ZoomRoom> {
  const { data } = await http.post<ZoomRoom>('/zoom-rooms', payload);
  return data;
}

export async function updateZoomRoom(
  id: string,
  payload: Partial<ZoomRoomFormData>,
): Promise<ZoomRoom> {
  const { data } = await http.put<ZoomRoom>(`/zoom-rooms/${id}`, payload);
  return data;
}

export async function deleteZoomRoom(id: string): Promise<void> {
  await http.delete(`/zoom-rooms/${id}`);
}
