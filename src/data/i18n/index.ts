import it from './it';
import en from './en';
export type { Dict } from './it';

export const dictionaries = { it, en } as const;
export type Locale = keyof typeof dictionaries;

/** Return the copy dictionary for a locale (falls back to IT). */
export function t(locale: string): (typeof dictionaries)[Locale] {
  return dictionaries[(locale as Locale)] ?? dictionaries.it;
}
