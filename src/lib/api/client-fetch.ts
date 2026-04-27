import { clearAuthStorage } from "@/lib/auth-storage";

export async function clientFetch(input: string, init?: RequestInit) {
  const res = await fetch(input, init);
  if (res.status === 401) {
    clearAuthStorage();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }
  return res;
}
