import { ref, computed } from 'vue';

const TOKEN_KEY = 'tosuthien.admin.token';
const USER_KEY = 'tosuthien.admin.user';

export type AdminUser = {
  id: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
};

const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
const user = ref<AdminUser | null>(readUser());

function readUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(token.value));

  function setSession(accessToken: string, nextUser: AdminUser) {
    token.value = accessToken;
    user.value = nextUser;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }

  function clearSession() {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getToken() {
    return token.value;
  }

  return {
    token,
    user,
    isAuthenticated,
    setSession,
    clearSession,
    getToken,
  };
}
