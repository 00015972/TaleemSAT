export const DEFAULT_AUTH_REDIRECT = '/dashboard';

const REDIRECT_VALIDATION_ORIGIN = 'https://taleemsat.invalid';
const MAX_REDIRECT_LENGTH = 2048;
const UNSAFE_CHARACTERS = /[\\\u0000-\u001f\u007f]/;

function hasUnsafeDecodedForm(value: string) {
  let decoded = value;

  for (let pass = 0; pass < 4; pass += 1) {
    if (UNSAFE_CHARACTERS.test(decoded) || decoded.startsWith('//')) return true;

    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      // Malformed encoding in the supplied value is invalid. A later pass can
      // encounter a literal percent that was validly encoded as `%25`.
      return pass === 0;
    }
    if (next === decoded) return false;
    decoded = next;
  }

  return UNSAFE_CHARACTERS.test(decoded) || decoded.startsWith('//');
}

/**
 * Returns a same-origin application path or the supplied safe fallback.
 *
 * This helper is deliberately independent of request/browser globals so the
 * same redirect boundary can be used by Server and Client Components.
 */
export function getSafeAuthRedirect(
  value: unknown,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  const safeFallback =
    typeof fallback === 'string' &&
    fallback.startsWith('/') &&
    !fallback.startsWith('//') &&
    !UNSAFE_CHARACTERS.test(fallback)
      ? fallback
      : DEFAULT_AUTH_REDIRECT;

  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_REDIRECT_LENGTH ||
    value !== value.trim() ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    UNSAFE_CHARACTERS.test(value)
  ) {
    return safeFallback;
  }

  try {
    if (hasUnsafeDecodedForm(value)) return safeFallback;

    const parsed = new URL(value, REDIRECT_VALIDATION_ORIGIN);
    if (parsed.origin !== REDIRECT_VALIDATION_ORIGIN) return safeFallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
}

export function buildAuthCallbackUrl(
  origin: string,
  options: { next?: string; flow?: 'recovery' } = {}
) {
  const url = new URL('/auth/callback', origin);

  if (options.next) {
    url.searchParams.set('next', getSafeAuthRedirect(options.next));
  }
  if (options.flow) url.searchParams.set('flow', options.flow);

  return url.toString();
}
