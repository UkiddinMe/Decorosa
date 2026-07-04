// DECOROSA — the single source of truth for showcase pieces.
// Every piece is a bespoke "world" (hand-coded). Adding a piece = append here +
// drop assets in public/assets/pieces/<id>/ + (if new aesthetic) a worlds/* component.

export type WorldKind = 'disco' | 'jungle' | 'desert';

export interface Piece {
  /** slug; also the asset folder name under public/assets/pieces/<id>/ */
  id: string;
  /** which worlds/* component renders the detail panel */
  world: WorldKind;
  /** position in the 3D spiral */
  spiral: { angleDeg: number; radius: number; dropY: number };
  /** cover image path (public/) shown on the spiral card */
  cover: string;
  /** localized text */
  i18n: Record<'it' | 'en', { title: string; subtitle?: string; body: string }>;
}

export const pieces: Piece[] = [
  {
    id: 'comodino-disco',
    world: 'disco',
    spiral: { angleDeg: 0, radius: 360, dropY: 0 },
    // NOTE: angle/dropY/turns are coupled so each card faces front exactly at
    // viewport center — see showcase.ts (turns) for the relationship.
    cover: '/assets/pieces/comodino-disco/cover.png',
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
    spiral: { angleDeg: 120, radius: 360, dropY: 700 },
    cover: '/assets/pieces/credenza-jungle/cover.png',
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
    spiral: { angleDeg: 240, radius: 360, dropY: 1400 },
    cover: '/assets/pieces/sedia-dessert/cover.png',
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
];
