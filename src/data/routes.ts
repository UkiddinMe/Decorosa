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

export const normalize = (path: string): string => path.replace(/\/+$/, '') || '/';

/** The IT/EN pair that the given pathname belongs to (if any). */
export function pairFor(path: string): RoutePair | undefined {
  const p = normalize(path);
  return routePairs.find((r) => r.it === p || r.en === p);
}
