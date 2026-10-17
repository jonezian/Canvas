// Canvas LMS API client — read-only, zero-dependency (Node 18+ native fetch).
//
// Every request goes through fetchApi(). Only GET and HEAD are ever sent:
// a Canvas personal access token is FULL access as the user (it can submit
// assignments, post to discussions, delete things). This tool never writes,
// and the guard is here so a single code path enforces it rather than trusting
// each call site. If you want write access, you are using the wrong tool.

const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

// A persistent rate-limit must not loop forever: give up after this many 20 s waits.
const MAX_THROTTLE_RETRIES = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Canvas paginates via the RFC 5988 Link header. per_page=100 looks like a
// complete response even when there are three more pages — a silent truncation
// if you don't follow rel="next".
function nextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

export function createClient({ baseUrl, token, onError, throttleMs = 120 }) {
  if (!baseUrl) throw new Error('baseUrl puuttuu');
  if (!token) throw new Error('token puuttuu');
  const base = baseUrl.replace(/\/+$/, '') + '/api/v1';
  // The access token is only ever sent to the configured institution's origin.
  // Canvas returns absolute pagination URLs in the Link header, and other fields
  // can contain absolute URLs too; a malicious or compromised server could point
  // those at another host to capture the Bearer token. We refuse any request
  // whose origin differs from baseOrigin, so the token cannot leak off-host.
  const baseOrigin = new URL(base).origin;
  let requests = 0;

  async function fetchApi(pathOrUrl, { paginate = true, method = 'GET' } = {}) {
    if (!ALLOWED_METHODS.has(method)) {
      throw new Error(
        `Canvas-collect is read-only: ${method} is blocked (${pathOrUrl}). `
        + 'This tool never writes to Canvas.',
      );
    }
    let url = pathOrUrl.startsWith('http') ? pathOrUrl : `${base}/${pathOrUrl}`;
    const all = [];
    let throttled = 0;
    while (url) {
      // Never send the token anywhere but the configured institution origin.
      let origin;
      try { origin = new URL(url).origin; } catch { onError?.({ path: pathOrUrl, error: 'invalid url' }); return null; }
      if (origin !== baseOrigin) {
        onError?.({ path: pathOrUrl, error: `refused off-origin request to ${origin}` });
        // Keep the pages already received; only the rest of the list is dropped.
        return all.length ? all : null;
      }
      requests++;
      let r;
      try {
        r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        onError?.({ path: pathOrUrl, error: 'network: ' + e.message });
        return null;
      }
      // Canvas signals throttling with 403 + x-rate-limit-remaining: 0.
      if (r.status === 403 && r.headers.get('x-rate-limit-remaining') === '0') {
        if (++throttled > MAX_THROTTLE_RETRIES) {
          onError?.({ path: pathOrUrl, error: `still rate-limited after ${MAX_THROTTLE_RETRIES} retries` });
          return all.length ? all : null;
        }
        onError?.({ path: pathOrUrl, error: 'rate-limited, waiting 20s' });
        await sleep(20000);
        continue;
      }
      if (!r.ok) { onError?.({ path: pathOrUrl, status: r.status }); return null; }
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('json')) { onError?.({ path: pathOrUrl, error: 'non-json: ' + ct }); return null; }
      const data = await r.json();
      if (!Array.isArray(data)) return data; // single object → no pagination
      all.push(...data);
      url = paginate ? nextLink(r.headers.get('link')) : null;
      if (url) await sleep(throttleMs);
    }
    return all;
  }

  return { fetchApi, get requests() { return requests; } };
}
