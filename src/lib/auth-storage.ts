export const AUTH_STORAGE_KEY = "proadmin.auth";

type StoredAuthUser = {
  id?: string;
  phone?: string;
  role?: string;
  permissions?: string[];
};

type StoredAuthPayload = {
  loggedInAt: string;
  user: StoredAuthUser;
};

export function saveAuthToStorage(user: StoredAuthUser) {
  if (typeof window === "undefined") return;
  const payload: StoredAuthPayload = {
    loggedInAt: new Date().toISOString(),
    user,
  };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

export function clearAuthStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function hasAuthStorage(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(AUTH_STORAGE_KEY));
}
