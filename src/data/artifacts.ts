// DECOROSA — the single source of truth for the artist's artifacts ("MY" section).
// They are shown as a finite lateral run on /opere (/en/works) and each one gets
// its own horizontal-parallax detail page at /opere/<id> (/en/works/<id>).
// Adding an artifact = append here + its cut-out at public/assets/artifacts/<id>.webp
// (build-image-assets.py) + (only if it needs a new aesthetic) a worlds/* component
// registered in ArtifactPage.

export type WorldKind = 'disco' | 'jungle' | 'desert';

export interface Artifact {
  /** slug; also the cut-out's name, public/assets/artifacts/<id>.webp */
  id: string;
  /** which worlds/* component renders the scenery of its detail page */
  world: WorldKind;
  /** already sold: still has its own page, but is left out of the dark-side list */
  sold?: boolean;
  /**
   * Shows the tiger chest cut-out (the showcase's "MY" piece, `tigerArt` in panels.ts)
   * in place of the card plate, opening its mouth on hover.
   */
  tiger?: boolean;
  /** intrinsic size of the cut-out (every artifact but the tiger has one) */
  image?: { w: number; h: number };
  /** localized text */
  i18n: Record<'it' | 'en', { title: string; subtitle?: string; body: string }>;
}

export const artifacts: Artifact[] = [
  {
    // First of the run, and the one the tiger chest stands for: its card *is* the piece.
    id: 'credenza-jungle',
    world: 'jungle',
    tiger: true,
    i18n: {
      it: {
        title: 'Tigre',
        subtitle: 'Lorem ipsum',
        body: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.',
      },
      en: {
        title: 'Tigre',
        subtitle: 'Lorem ipsum',
        body: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.',
      },
    },
  },
  {
    id: 'attacchini',
    image: { w: 597, h: 1043 },
    world: 'disco',
    i18n: {
      it: {
        title: 'Attacchini',
        subtitle: 'The dark side of the mood',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.',
      },
      en: {
        title: 'Attacchini',
        subtitle: 'The dark side of the mood',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.',
      },
    },
  },
  {
    id: 'si-sta-come-d-inverno',
    image: { w: 932, h: 829 },
    world: 'desert',
    i18n: {
      it: {
        title: "Si sta come d'inverno sui tavoli le foglie",
        subtitle: 'Lorem ipsum',
        body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
      },
      en: {
        title: "Si sta come d'inverno sui tavoli le foglie",
        subtitle: 'Lorem ipsum',
        body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
      },
    },
  },
  {
    id: 'giungla-dei-colori',
    image: { w: 842, h: 1200 },
    sold: true,
    world: 'disco',
    i18n: {
      it: {
        title: 'Giungla dei colori primari',
        subtitle: 'Lorem ipsum',
        body: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim.',
      },
      en: {
        title: 'Giungla dei colori primari',
        subtitle: 'Lorem ipsum',
        body: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim.',
      },
    },
  },
  {
    id: 'drago',
    image: { w: 1022, h: 1200 },
    sold: true,
    world: 'jungle',
    i18n: {
      it: {
        title: 'Drago',
        subtitle: 'Lorem ipsum',
        body: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur.',
      },
      en: {
        title: 'Drago',
        subtitle: 'Lorem ipsum',
        body: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur.',
      },
    },
  },
  {
    id: 'llorona',
    image: { w: 1064, h: 1200 },
    sold: true,
    world: 'desert',
    i18n: {
      it: {
        title: 'Llorona',
        subtitle: 'Lorem ipsum',
        body: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
      },
      en: {
        title: 'Llorona',
        subtitle: 'Lorem ipsum',
        body: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
      },
    },
  },
  {
    id: 'metto-il-becco',
    image: { w: 665, h: 1200 },
    world: 'jungle',
    i18n: {
      it: {
        title: 'Metto il becco nelle vostre credenze',
        subtitle: 'Lorem ipsum',
        body: 'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae.',
      },
      en: {
        title: 'Metto il becco nelle vostre credenze',
        subtitle: 'Lorem ipsum',
        body: 'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae.',
      },
    },
  },
];

/** The artifact's cut-out (not the tiger's: that one is `tigerArt` in panels.ts). */
export const artifactImage = (a: Artifact): string => `/assets/artifacts/${a.id}.webp`;

/** The ones still up for grabs — the dark-side page lists only these. */
export const availableArtifacts = artifacts.filter((a) => !a.sold);

/** Placeholder icon (the world's own focal glyph) for compact lists — dark-side page. */
const worldIcon: Record<WorldKind, string> = { disco: '🪩', jungle: '🌴', desert: '🍰' };
export const artifactIcon = (a: Artifact): string => worldIcon[a.world];

export const artifactPath = (id: string, lang: 'it' | 'en'): string =>
  lang === 'it' ? `/opere/${id}` : `/en/works/${id}`;
