// DECOROSA — Italian copy (default locale). The `Dict` type is the contract every
// locale must satisfy; en.ts imports and conforms to it.
export type Dict = {
  meta: { title: string; description: string };
  nav: { enter: string; contacts: string; back: string };
  slogan: { lead: string; items: string[] };
  contacts: { heading: string; intro: string; email: string; instagram: string };
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
};

export default it;
