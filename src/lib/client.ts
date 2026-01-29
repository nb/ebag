import type { Config, Session } from './types';

export type RequestResult<T> = {
  status: number;
  data: T;
  headers: Record<string, string>;
};

function normalizeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function getCookieValue(cookies: string | undefined, name: string) {
  if (!cookies) return undefined;
  const parts = cookies.split(';').map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return part.slice(name.length + 1);
    }
  }
  return undefined;
}

export async function requestEbag<T>(
  config: Config,
  session: Session,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | URLSearchParams;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<RequestResult<T>> {
  const baseUrl = config.baseUrl || 'https://www.ebag.bg';
  const url = new URL(path, baseUrl);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    ...options.headers,
  };
  if (session.cookies) {
    headers.cookie = session.cookies;
  }
  const method = (options.method || 'GET').toUpperCase();
  if (!headers['x-csrftoken'] && method !== 'GET') {
    const token = getCookieValue(session.cookies, 'csrftoken');
    if (token) {
      headers['x-csrftoken'] = token;
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: options.body instanceof URLSearchParams ? options.body.toString() : options.body,
  });

  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  const data = contentType.includes('application/json') ? (JSON.parse(raw) as T) : (raw as T);

  if (!response.ok) {
    const err = new Error(`Request failed ${response.status} ${url}`);
    (err as Error & { status?: number; body?: string; url?: string; method?: string }).status =
      response.status;
    (err as Error & { status?: number; body?: string; url?: string; method?: string }).body = raw;
    (err as Error & { status?: number; body?: string; url?: string; method?: string }).url =
      url.toString();
    (err as Error & { status?: number; body?: string; url?: string; method?: string }).method =
      method;
    throw err;
  }

  return {
    status: response.status,
    data,
    headers: normalizeHeaders(response.headers),
  };
}

export async function requestAlgolia<T>(
  config: Config,
  body: unknown,
): Promise<RequestResult<T>> {
  const host = config.algolia?.host || 'jmjmdq9hhx-dsn.algolia.net';
  const appId = config.algolia?.appId || 'JMJMDQ9HHX';
  const apiKey = config.algolia?.apiKey || '42ca9458d9354298c7016ce9155d8481';

  const url = new URL(`/1/indexes/*/queries`, `https://${host}`);
  url.searchParams.set(
    'x-algolia-agent',
    'Algolia for JavaScript (4.24.0); Browser; instantsearch.js (4.80.0)',
  );

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'x-algolia-application-id': appId,
      'x-algolia-api-key': apiKey,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  const data = contentType.includes('application/json') ? (JSON.parse(raw) as T) : (raw as T);

  if (!response.ok) {
    const err = new Error(`Algolia request failed ${response.status}`);
    (err as Error & { status?: number; body?: string; url?: string; method?: string }).status =
      response.status;
    (err as Error & { status?: number; body?: string; url?: string; method?: string }).body = raw;
    (err as Error & { status?: number; body?: string; url?: string; method?: string }).url =
      url.toString();
    (err as Error & { status?: number; body?: string; url?: string; method?: string }).method =
      'POST';
    throw err;
  }

  return {
    status: response.status,
    data,
    headers: normalizeHeaders(response.headers),
  };
}
