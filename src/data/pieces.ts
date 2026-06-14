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
    cover: '/assets/pieces/comodino-disco/cover.png',
    i18n: {
      it: {
        title: 'Comodino Disco',
        subtitle: 'The dark side of the mood',
        body: 'Un comodino anni ’70 riportato in vita sotto la palla stroboscopica.',
      },
      en: {
        title: 'Disco Nightstand',
        subtitle: 'The dark side of the mood',
        body: 'A 1970s nightstand brought back to life under the mirror ball.',
      },
    },
  },
  {
    id: 'credenza-jungle',
    world: 'jungle',
    spiral: { angleDeg: 137.5, radius: 360, dropY: 520 },
    cover: '/assets/pieces/credenza-jungle/cover.png',
    i18n: {
      it: {
        title: 'Credenza Jungle',
        subtitle: 'Domestic jungle',
        body: 'Una credenza che diventa serra: foglie tropicali e ottoni.',
      },
      en: {
        title: 'Jungle Sideboard',
        subtitle: 'Domestic jungle',
        body: 'A sideboard turned greenhouse: tropical leaves and brass.',
      },
    },
  },
  {
    id: 'sedia-dessert',
    world: 'desert',
    spiral: { angleDeg: 275, radius: 360, dropY: 1040 },
    cover: '/assets/pieces/sedia-dessert/cover.png',
    i18n: {
      it: {
        title: 'Sedia Dessert',
        subtitle: 'DESSERT',
        body: 'Una seduta dolce come una duna: pastello e zucchero filato.',
      },
      en: {
        title: 'Dessert Chair',
        subtitle: 'DESSERT',
        body: 'A seat as sweet as a dune: pastels and candy floss.',
      },
    },
  },
];
