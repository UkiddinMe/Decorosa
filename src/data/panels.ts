// DECOROSA — the three panels of the showcase spiral. They are not products: each one
// is a doorway into a section of the site. Exactly three, by design — the spiral geometry
// (angles 120deg apart) and the `turns` constant in showcase.ts are tuned for three.

export interface Panel {
  /** slug — only used as a DOM hook */
  id: string;
  /** big title shown beside the panel; brand-fixed, identical in both locales */
  title: string;
  /** position in the 3D spiral */
  spiral: { angleDeg: number; radius: number; dropY: number };
  /** section this panel opens, per locale (root-relative, before withBase()) */
  href: Record<'it' | 'en', string>;
  /** placeholder artwork until the client's images land */
  media: string;
}

export const panels: Panel[] = [
  {
    id: 'bio',
    title: 'I AM',
    // NOTE: angle/dropY/turns are coupled so each panel faces front exactly at
    // viewport centre — see showcase.ts (turns) for the relationship.
    spiral: { angleDeg: 0, radius: 360, dropY: 0 },
    href: { it: '/bio', en: '/en/bio' },
    media: 'var(--panel-iam-bg)',
  },
  {
    id: 'works',
    title: 'MY',
    spiral: { angleDeg: 120, radius: 360, dropY: 700 },
    href: { it: '/opere', en: '/en/works' },
    media: 'var(--panel-my-bg)',
  },
  {
    id: 'dark-side',
    title: 'DARK SIDE OF THE MOOD',
    spiral: { angleDeg: 240, radius: 360, dropY: 1400 },
    href: { it: '/dark-side', en: '/en/dark-side' },
    media: 'var(--panel-dark-bg)',
  },
];
