/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Mail-relay URL the contacts form POSTs to. Unset → the form falls back to `mailto:`. */
  readonly PUBLIC_CONTACT_ENDPOINT?: string;
}
