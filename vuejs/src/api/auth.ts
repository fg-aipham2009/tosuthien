import http from './http';
import type { AdminUser } from '@/composables/useAuth';

export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: AdminUser;
};

export async function login(username: string, password: string) {
  const { data } = await http.post<LoginResponse>('/auth/login', {
    username,
    password,
  });
  return data;
}

export async function fetchMe() {
  const { data } = await http.get<AdminUser>('/auth/me');
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await http.put('/auth/me/password', {
    currentPassword,
    newPassword,
  });
  return data;
}

export async function listAdminUsers() {
  const { data } = await http.get<AdminUser[]>('/auth/users');
  return data;
}

export async function createAdminUser(payload: {
  username: string;
  password: string;
  displayName?: string;
  isActive?: boolean;
}) {
  const { data } = await http.post<AdminUser>('/auth/users', payload);
  return data;
}

export async function updateAdminUser(
  id: string,
  payload: {
    displayName?: string | null;
    isActive?: boolean;
    password?: string;
  },
) {
  const { data } = await http.put<AdminUser>(`/auth/users/${id}`, payload);
  return data;
}

export async function deleteAdminUser(id: string) {
  await http.delete(`/auth/users/${id}`);
}
