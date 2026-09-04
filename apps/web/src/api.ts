const getApiBase = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, "") + "/api";
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname || "localhost";
    const protocol = window.location.protocol || "http:";
    return `${protocol}//${host}:8787/api`;
  }
  return "http://localhost:8787/api";
};

const api = getApiBase();

export async function call<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let response: Response;
  try {
    response = await fetch(api + path, {
      ...options,
      headers,
    });
  } catch (err) {
    // If direct connection to port 8787 fails, fallback to Vite's local /api proxy
    try {
      response = await fetch("/api" + path, {
        ...options,
        headers,
      });
    } catch {
      throw err;
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed.");
  }
  return response.json() as Promise<T>;
}
