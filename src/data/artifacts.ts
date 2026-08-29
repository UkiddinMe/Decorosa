// DECOROSA — the single source of truth for the artist's artifacts ("MY" section).
// They are shown as a finite lateral run on /opere (/en/works) and each one gets
// its own horizontal-parallax detail page at /opere/<id> (/en/works/<id>).
// Adding an artifact = append here + drop assets in public/assets/artifacts/<id>/ +
// (only if it needs a new aesthetic) a worlds/* component registered in ArtifactPage.

export type WorldKind = 'disco' | 'jungle' | 'desert';

export interface Artifact {
  /** slug; also the asset folder name under public/assets/artifacts/<id>/ */
  id: string;
  /** which worlds/* component renders the scenery of its detail page */
  world: WorldKind;
  /** already sold: still has its own page, but is left out of the dark-side list */
  sold?: boolean;
  /** localized text */
  i18n: Record<'it' | 'en', { title: string; subtitle?: string; body: string }>;
}

export const artifacts: Artifact[] = [
  {
    id: 'comodino-disco',
    world: 'disco',
    i18n: {
      it: {
        title: 'Item 1',
        subtitle: 'The dark side of the mood',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.',
      },
      en: {
        title: 'Item 1',
        subtitle: 'The dark side of the mood',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.',
      },
    },
  },
  {
    id: 'credenza-jungle',
    world: 'jungle',
    i18n: {
      it: {
        title: 'Credenza Jungle',
        subtitle: 'Lorem ipsum',
        body: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.',
      },
      en: {
        title: 'Jungle Sideboard',
        subtitle: 'Lorem ipsum',
        body: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.',
      },
    },
  },
  {
    id: 'sedia-dessert',
    world: 'desert',
    i18n: {
      it: {
        title: 'Item 3',
        subtitle: 'Lorem ipsum',
        body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
      },
      en: {
        title: 'Item 3',
        subtitle: 'Lorem ipsum',
        body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
      },
    },
  },
  {
    id: 'item-4',
    sold: true,
    world: 'disco',
    i18n: {
      it: {
        title: 'Item 4',
        subtitle: 'Lorem ipsum',
        body: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim.',
      },
      en: {
        title: 'Item 4',
        subtitle: 'Lorem ipsum',
        body: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim.',
      },
    },
  },
  {
    id: 'item-5',
    sold: true,
    world: 'jungle',
    i18n: {
      it: {
        title: 'Item 5',
        subtitle: 'Lorem ipsum',
        body: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur.',
      },
      en: {
        title: 'Item 5',
        subtitle: 'Lorem ipsum',
        body: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur.',
      },
    },
  },
  {
    id: 'item-6',
    sold: true,
    world: 'desert',
    i18n: {
      it: {
        title: 'Item 6',
        subtitle: 'Lorem ipsum',
        body: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
      },
      en: {
        title: 'Item 6',
        subtitle: 'Lorem ipsum',
        body: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
      },
    },
  },
];

/** Placeholder gradient for an artifact's card/hero until real artwork lands. */
export const artifactMedia = (a: Artifact): string => `var(--world-${a.world}-bg)`;

/** The ones still up for grabs — the dark-side page lists only these. */
export const availableArtifacts = artifacts.filter((a) => !a.sold);

/** Placeholder icon (the world's own focal glyph) for compact lists — dark-side page. */
const worldIcon: Record<WorldKind, string> = { disco: '🪩', jungle: '🌴', desert: '🍰' };
export const artifactIcon = (a: Artifact): string => worldIcon[a.world];

export const artifactPath = (id: string, lang: 'it' | 'en'): string =>
  lang === 'it' ? `/opere/${id}` : `/en/works/${id}`;
