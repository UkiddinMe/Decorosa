// DECOROSA — Italian copy (default locale). The `Dict` type is the contract every
// locale must satisfy; en.ts imports and conforms to it.
export type Dict = {
  meta: { title: string; description: string };
  nav: { enter: string; contacts: string; back: string; backToWorks: string; mainWorks: string };
  slogan: { lead: string; items: string[] };
  contacts: { heading: string; intro: string; email: string; instagram: string };
  bio: { heading: string; hint: string };
  works: { heading: string; hint: string; tiles: string; backToShowcase: string };
  tiles: { heading: string };
  darkSide: { heading: string; paragraphs: string[] };
};

export const it: Dict = {
  meta: {
    title: 'DECOROSA',
    description:
      'Un progetto artistico che dà nuova vita a mobili, tessuti, oggetti e ambienti.',
  },
  nav: {
    enter: 'Entra nel mood',
    contacts: 'Contatti',
    back: 'Indietro',
    backToWorks: 'Tutte le opere',
    mainWorks: 'Opere principali',
  },
  slogan: {
    lead: 'Un progetto artistico che vuole dare nuova vita a qualcosa che non sapevi potesse essere «bello»',
    items: ['Un mobile', 'Un tessuto', 'Un oggetto', 'Un ambiente'],
  },
  contacts: {
    heading: 'Contatti',
    intro: 'Per collaborazioni, commissioni e progetti su misura.',
    email: 'ciao@decorosa.art',
    instagram: '@decorosa',
  },
  bio: {
    heading: 'I AM',
    hint: 'Scorri lateralmente',
  },
  works: {
    heading: 'MY',
    hint: 'Scorri lateralmente',
    tiles: 'Ne vuoi ancora?',
    backToShowcase: 'Torna al menù',
  },
  tiles: {
    heading: 'Mosaico',
  },
  darkSide: {
    heading: 'DARK SIDE OF THE MOOD',
    paragraphs: [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
    ],
  },
};

export default it;
