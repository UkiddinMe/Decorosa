// DECOROSA — the artist's timeline ("I AM" section). Rendered as a horizontal ruler of
// brushstroke ticks; every entry here gets a taller tick, a year label and a photo.
// Placeholder copy — replace with the client's own milestones. Keep it chronological:
// events are laid out in order, one ruler slot each.

export interface BioEvent {
  year: number;
  /** placeholder tint until public/assets/bio/<year>.jpg lands */
  tint: string;
  i18n: Record<'it' | 'en', { title: string; description: string }>;
}

const placeholder = {
  it: {
    title: 'Lorem ipsum',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
  en: {
    title: 'Lorem ipsum',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  },
};

export const bioEvents: BioEvent[] = [
  { year: 1994, tint: 'var(--c-yellow)', i18n: placeholder },
  { year: 2008, tint: 'var(--c-green)', i18n: placeholder },
  { year: 2013, tint: 'var(--c-purple)', i18n: placeholder },
  { year: 2017, tint: 'var(--c-orange)', i18n: placeholder },
  { year: 2020, tint: 'var(--c-red)', i18n: placeholder },
  { year: 2023, tint: 'var(--c-grey)', i18n: placeholder },
  { year: 2026, tint: 'var(--c-black)', i18n: placeholder },
];
