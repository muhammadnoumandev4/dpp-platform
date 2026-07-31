const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  blockers?: { code: string; path: string; message: string }[];
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: ApiErrorBody | null) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  redirectOnUnauthorized?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const { timeoutMs = DEFAULT_TIMEOUT_MS, redirectOnUnauthorized = true, ...rest } = options;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers,
      credentials: 'include',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError(0, 'The request timed out.');
    }
    throw new ApiError(0, 'Network error — could not reach the server.');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (res.status === 401 && redirectOnUnauthorized && typeof window !== 'undefined') {
    // Central 401 handling: any expired/invalid token drops the user back
    // to sign-in from wherever they were, rather than every call site
    // having to special-case it.
    if (window.location.pathname !== '/login') {
      // Single login route for brand and platform staff — there is no /admin/login.
      // Carry the current location so signing back in returns the user there,
      // matching what the middleware does for a missing session cookie.
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
    }
  }

  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message || res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, options?: Pick<RequestOptions, 'redirectOnUnauthorized' | 'timeoutMs'>) =>
    request<T>(path, options),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File, purpose: 'image' | 'document') => {
    const form = new FormData();
    form.append('file', file);
    form.append('purpose', purpose);
    // Uploads get a longer timeout than the default JSON round-trip.
    return request<T>(path, { method: 'POST', body: form, timeoutMs: 60_000 });
  },
};

export { API_URL };
