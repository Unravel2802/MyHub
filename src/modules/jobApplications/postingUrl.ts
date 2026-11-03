// Normalises what the user typed into the Link cell before it reaches
// `UpdateApplicationInput.postingUrl`. Mirrors migration 0048's check
// constraint, which is the real boundary: the value is rendered as an <a href>,
// so anything other than http(s) — `javascript:`, `data:`, `mailto:` — must be
// refused rather than stored.
//
// Pasting "linkedin.com/jobs/view/123" is the common case, so a missing scheme
// gets `https://` rather than an error.

export const POSTING_URL_MAX_LENGTH = 2048;

export type PostingUrlResult =
  { ok: true; value: string | null } | { ok: false };

export function normalizePostingUrl(raw: string): PostingUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (/\s/.test(trimmed)) return { ok: false };

  // A scheme is letters followed by ":" — but "localhost:3000/x" and
  // "example.com:8080/x" also match that shape, so only treat it as a scheme
  // when it isn't followed by a port number.
  const scheme = /^([a-z][a-z0-9+.-]*):(?!\d)/i.exec(trimmed)?.[1];
  const candidate = scheme ? trimmed : `https://${trimmed}`;
  if (scheme && !/^https?$/i.test(scheme)) return { ok: false };

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { ok: false };
  // "https://foo" parses, but a posting link without a dot in the host is
  // almost certainly a typo ("linkedin" alone), not an intranet URL.
  if (!url.hostname.includes(".") && url.hostname !== "localhost") {
    return { ok: false };
  }
  const value = url.href;
  if (value.length > POSTING_URL_MAX_LENGTH) return { ok: false };
  return { ok: true, value };
}
