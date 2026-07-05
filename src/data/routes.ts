// Shared route map for the two locales — used by the language toggle and by hreflang
// alternate tags. IT is unprefixed; EN lives under /en (with locale-specific slugs).
export interface RoutePair {
  it: string;
  en: string;
}

export const routePairs: RoutePair[] = [
  { it: '/', en: '/en' },
  { it: '/showcase', en: '/en/showcase' },
  { it: '/contatti', en: '/en/contact' },
];

// Deploy base path without trailing slash ('' when deployed at the domain root).
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Prefix a root-relative path with the deploy base (e.g. '/Decorosa' on GitHub Pages). */
export const withBase = (path: string): string => `${BASE}${path}`;

export const normalize = (path: string): string => {
  let p = path.replace(/\/+$/, '') || '/';
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length) || '/';
  return p;
};

/** The IT/EN pair that the given pathname belongs to (if any). */
export function pairFor(path: string): RoutePair | undefined {
  const p = normalize(path);
  return routePairs.find((r) => r.it === p || r.en === p);
}
