// DECOROSA — the artist's timeline ("I AM" section). Rendered as a horizontal ruler of
// brushstroke ticks; every entry here gets a taller tick, a year label and a photo.
// The copy is the artist's own. Keep it chronological: events are laid out in order,
// one ruler slot each (years may repeat — two 2016 slots, three 2018 ones).
// Artwork still missing: the 1994 catalogue cover and painting clip, and the three
// Portugal pieces. Those slots stay on their placeholder tint until the files land.

export interface BioEvent {
  /** slug; also the asset name under public/assets/bio/ */
  id: string;
  /** ruler label; a locale may override it — the last slot reads OGGI / TODAY */
  year: string;
  /** placeholder tint, and the colour the photo's card still carries around it */
  tint: string;
  /**
   * Artwork under public/assets/bio/. Everything here shows in the event's panel, side by
   * side — the comic is five pages. A `.mp4`/`.webm` src plays as a video there. The first
   * entry is also the card's face when it is an image; when it is a video the card keeps
   * its tint and wears a play mark. `w`/`h` are the intrinsic size, so the browser can
   * hold the space before the file arrives — leave them out if unknown.
   *
   * No media at all = the card is a plain tint and is not clickable. An empty list = the
   * card opens its panel and the panel is blank, holding the place of artwork to come.
   */
  media?: { src: string; w?: number; h?: number }[];
  i18n: Record<'it' | 'en', { year?: string; title: string; description?: string }>;
}

export const bioEvents: BioEvent[] = [
  {
    id: 'nascita',
    year: '1991',
    tint: 'var(--c-yellow)',
    i18n: {
      it: { title: 'Nasco a Milano, di mercoledì' },
      en: { title: 'I am born in Milan, on a Wednesday' },
    },
  },
  {
    id: 'astrattismi-prefigurativi',
    year: '1994',
    tint: 'var(--c-orange)',
    // The panel is open for business, its artwork is not: the catalogue cover and the clip
    // of her painting go in here, cover first (an image first becomes the card's face),
    // e.g. { src: '/assets/bio/catalogo.webp', w: …, h: … }, { src: '/assets/bio/astrattismi.mp4' }
    media: [],
    i18n: {
      it: {
        title: 'Astrattismi prefigurativi',
        description:
          'Per il mio terzo compleanno, mio padre organizza una mostra dei miei quadri in una galleria di Brera. Costruisce attorno alle opere un vero e proprio scam: mi presenta come una misteriosa artista contemporanea, rivelando solo alla fine che quei quadri provenivano dall’attività di una bambina ai primi anni di vita.',
      },
      en: {
        title: 'Astrattismi prefigurativi',
        description:
          'For my third birthday, my father puts on a show of my paintings in a gallery in Brera. He builds a proper scam around the works: he introduces me as a mysterious contemporary artist, revealing only at the end that those paintings came from a little girl in her first years of life.',
      },
    },
  },
  {
    id: 'scuola',
    year: '1997',
    tint: 'var(--c-purple)',
    i18n: {
      it: {
        title: 'Inizia il mio percorso scolastico',
        description: 'Tra i portici del Collegio Villoresi San Giuseppe.',
      },
      en: {
        title: 'My school years begin',
        description: 'Among the porticoes of Collegio Villoresi San Giuseppe.',
      },
    },
  },
  {
    id: 'sassuolo',
    year: '2005',
    tint: 'var(--c-green)',
    i18n: {
      it: {
        title: 'Mi trasferisco a Sassuolo',
        description: 'Dove inizio il liceo scientifico.',
      },
      en: {
        title: 'I move to Sassuolo',
        description: 'Where I start scientific high school.',
      },
    },
  },
  {
    id: 'ritorno-milano',
    year: '2010',
    tint: 'var(--c-red)',
    i18n: {
      it: {
        title: 'Diplomata, torno a Milano',
        description:
          'Dove, al Politecnico, inizio a studiare una cosa che mi incuriosisce molto: lo spazio, le città, il modo in cui le persone le abitano.',
      },
      en: {
        title: 'Diploma in hand, I go back to Milan',
        description:
          'Where, at the Politecnico, I start studying something that intrigues me a lot: space, cities, the way people inhabit them.',
      },
    },
  },
  {
    id: 'fumetto',
    year: '2014',
    tint: 'var(--c-yellow)',
    media: [1, 2, 3, 4, 5].map((page) => ({
      src: `/assets/bio/fumetto-${page}.webp`,
      w: 679,
      h: 960,
    })),
    i18n: {
      it: {
        title: 'Il mio primo approccio “da grande” alla creatività',
        description:
          'Partecipo a un concorso per la realizzazione di un fumetto a Casa Corsini e vinco il premio alla creatività.',
      },
      en: {
        title: 'My first “grown-up” approach to creativity',
        description:
          'I enter a comic-book competition at Casa Corsini and win the creativity prize.',
      },
    },
  },
  {
    id: 'laurea-urbanistica',
    year: '2015',
    tint: 'var(--c-grey)',
    i18n: {
      it: {
        title: 'Mi laureo in Urbanistica al Politecnico di Milano',
        description:
          'Successivamente lavoro in alcuni studi di architettura milanesi, ma presto capisco che quella strada non è propriamente mia.',
      },
      en: {
        title: 'I graduate in Urban Planning at the Politecnico di Milano',
        description:
          'I then work in a few Milanese architecture practices, but I soon realise that road is not really mine.',
      },
    },
  },
  {
    id: 'ritorno-sassuolo',
    year: '2016',
    tint: 'var(--c-orange)',
    i18n: {
      it: {
        title: 'Torno a Sassuolo',
        description:
          'E inizio a lavorare in un’associazione che crea opportunità lavorative per persone considerate fragili. Mi ritrovo a gestire la parte creativa di un laboratorio dove si sperimentano materiali, tecniche e possibilità. È qui che comincio a capire quanto mi interessi il fare, insieme agli altri.',
      },
      en: {
        title: 'I move back to Sassuolo',
        description:
          'And I start working in an association that creates job opportunities for people considered fragile. I end up running the creative side of a workshop where materials, techniques and possibilities are tried out. This is where I begin to understand how much making things together with others interests me.',
      },
    },
  },
  {
    id: 'argentina',
    year: '2016',
    tint: 'var(--c-purple)',
    i18n: {
      it: {
        title: 'Viaggio per l’Argentina',
        description:
          'Lascia un segno. I colori, quelli accesi e senza paura, mi fanno riconoscere qualcosa che avevo già dentro: il bisogno di esprimermi attraverso la materia e la creatività. Inizio a pensare che forse posso costruire un progetto tutto mio.',
      },
      en: {
        title: 'I travel across Argentina',
        description:
          'It leaves a mark. The colours, bright and fearless, let me recognise something I already had inside: the need to express myself through matter and creativity. I start to think that maybe I can build a project of my own.',
      },
    },
  },
  {
    id: 'idea-progetto',
    year: '2017',
    tint: 'var(--c-green)',
    i18n: {
      it: {
        title: 'Nasce l’idea di un progetto personale',
        description:
          'Dedicato al restyling creativo dei mobili. Quello che fino a quel momento avevo sperimentato come coordinatrice comincia a diventare una strada autonoma.',
      },
      en: {
        title: 'The idea of a project of my own is born',
        description:
          'Devoted to the creative restyling of furniture. What until then I had tried out as a coordinator begins to become a road of my own.',
      },
    },
  },
  {
    id: 'progetto-prende-forma',
    year: '2018',
    tint: 'var(--c-red)',
    i18n: {
      it: {
        title: 'Il progetto prende forma',
        description:
          'Recuperare, trasformare, reinventare: il mobile diventa una superficie sulla quale sperimentare colore, materiali e nuove possibilità.',
      },
      en: {
        title: 'The project takes shape',
        description:
          'Salvage, transform, reinvent: a piece of furniture becomes a surface on which to try out colour, materials and new possibilities.',
      },
    },
  },
  {
    id: 'portogallo',
    year: '2018',
    tint: 'var(--c-black)',
    i18n: {
      it: {
        title: 'Residenze artistiche in Portogallo',
        description:
          'Un altro viaggio significativo è stato in un paesino del Portogallo, dove un carcere abbandonato verrà riconvertito in residenze artistiche. Ancora una volta torno a interrogarmi sul rapporto tra spazi, persone e trasformazione.',
      },
      en: {
        title: 'Artist residencies in Portugal',
        description:
          'Another meaningful journey was to a small village in Portugal, where an abandoned prison is to be converted into artist residencies. Once again I find myself questioning the relationship between spaces, people and transformation.',
      },
    },
  },
  {
    id: 'trento',
    year: '2018',
    tint: 'var(--c-yellow)',
    i18n: {
      it: {
        title: 'Continuo a studiare',
        description:
          'A settembre mi trasferisco a Trento per studiare Sociologia e approfondire ciò che da sempre mi interessa: il rapporto tra le persone e il territorio e il modo in cui possiamo prendercene cura. Lontana da Sassuolo e con poco spazio a disposizione, anche il mio progetto cambia forma. Comincio a ricamare e a realizzare piccoli mobili.',
      },
      en: {
        title: 'I keep studying',
        description:
          'In September I move to Trento to study Sociology and dig into what has always interested me: the relationship between people and their territory, and the way we can take care of it. Far from Sassuolo and with little space, my project changes shape too. I start embroidering and making small pieces of furniture.',
      },
    },
  },
  {
    id: 'entrata-indecorosa',
    year: '2022',
    tint: 'var(--c-orange)',
    media: [{ src: '/assets/bio/entrata.webp', w: 1200, h: 1200 }],
    i18n: {
      it: {
        title: 'Entrata indecorosa',
        description:
          'Mi laureo in Sociologia e Gestione del Territorio a Trento. Torno a Sassuolo e apro il mio laboratorio creativo. Uno spazio fisico, ma anche il punto d’incontro di tutto quello che ho attraversato fino a qui: arte, materia, persone, territorio e trasformazione.',
      },
      en: {
        title: 'Entrata indecorosa',
        description:
          'I graduate in Sociology and Territorial Management in Trento. I go back to Sassuolo and open my creative workshop. A physical space, but also the meeting point of everything I have been through so far: art, matter, people, territory and transformation.',
      },
    },
  },
  {
    id: 'oggi',
    year: '2026',
    tint: 'var(--c-black)',
    i18n: {
      it: {
        year: 'OGGI',
        title: 'Continuo a sperimentare',
        description:
          'Recupero, trasformo, dipingo, ricamo. Cerco nuove forme per dare una seconda vita alle cose e, forse, anche nuovi modi per raccontare il mondo che ho dentro e che mi circonda.',
      },
      en: {
        year: 'TODAY',
        title: 'I keep experimenting',
        description:
          'I salvage, transform, paint, embroider. I look for new forms to give things a second life and, maybe, new ways to tell the world I carry inside and the one around me.',
      },
    },
  },
];
