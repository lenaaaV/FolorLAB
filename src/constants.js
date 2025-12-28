export const BADGES = [
    { id: 1, name: 'Neuling', icon: '🌱', threshold: 0, description: 'Der Anfang ist gemacht. Du hast deine erste Reise begonnen.' },
    { id: 2, name: 'Entdecker', icon: '🧭', threshold: 5, description: 'Du hast 5 Orte besucht und beginnst, die Welt zu verstehen.' },
    { id: 3, name: 'Pionier', icon: '🚀', threshold: 10, description: '10 Orte! Du bist auf dem besten Weg, ein Legende zu werden.' },
    { id: 4, name: 'Kartograph', icon: '🗺️', threshold: 20, description: '20 Orte. Die Karte ist dein Zuhause.' },
];

export const CHALLENGES = [
    { id: 1, title: 'Der freundliche Nachbar', description: 'Mache einen Bäcker glücklich: Besuche eine Bäckerei deiner Wahl.', xp: 150, type: 'daily', completed: false },
    { id: 2, title: 'Grüne Oase', description: 'Finde Ruhe: Entdecke einen Park oder eine Grünfläche.', xp: 200, type: 'daily', completed: true },
    { id: 3, title: 'Nachteule', description: 'Die Stadt schläft nie: Besuche einen Spot nach 20:00 Uhr.', xp: 300, type: 'weekly', completed: false },
    { id: 4, title: 'Kultur-Vulture', description: 'Lerne etwas Neues: Besuche ein Museum oder eine historische Stätte.', xp: 250, type: 'weekly', completed: false },
];

export const MEMORY_BOARD_LOCATIONS = [
    // Darmstadt
    {
        id: 'darmstadt-tu',
        name: 'TU Darmstadt',
        coordinates: [8.6512, 49.8728],
        image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'darmstadt-ise',
        name: 'ISE x Google',
        coordinates: [8.65763, 49.87653],
        image: '/ise_google.png'
    },
    {
        id: 'darmstadt-mathildenhoehe',
        name: 'Mathildenhöhe',
        coordinates: [8.6672, 49.8776],
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Darmstadt_Mathildenhoehe_Russische_Kapelle_2005-08-18.jpg/1200px-Darmstadt_Mathildenhoehe_Russische_Kapelle_2005-08-18.jpg'
    },
    {
        id: 'darmstadt-herrngarten',
        name: 'Herrngarten',
        coordinates: [8.6530, 49.8755],
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Herrngarten_Darmstadt_2010.jpg/1200px-Herrngarten_Darmstadt_2010.jpg'
    },
    {
        id: 'darmstadt-vivarium',
        name: 'Vivarium',
        coordinates: [8.6750, 49.8660],
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Vivarium_Darmstadt_Eingang.jpg/1200px-Vivarium_Darmstadt_Eingang.jpg'
    },
    // Frankfurt
    {
        id: 'frankfurt-roemer',
        name: 'Römerberg',
        coordinates: [8.6821, 50.1109],
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/R%C3%B6merberg_Frankfurt_am_Main.jpg/1200px-R%C3%B6merberg_Frankfurt_am_Main.jpg'
    },
    {
        id: 'frankfurt-palmengarten',
        name: 'Palmengarten',
        coordinates: [8.6580, 50.1230],
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Palmengarten_Frankfurt_Palmenhaus.jpg/1200px-Palmengarten_Frankfurt_Palmenhaus.jpg'
    },
    {
        id: 'frankfurt-maintower',
        name: 'Main Tower',
        coordinates: [8.6719, 50.1125],
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Main_Tower_Frankfurt.jpg/1200px-Main_Tower_Frankfurt.jpg'
    },
    {
        id: 'frankfurt-eiserner-steg',
        name: 'Eiserner Steg',
        coordinates: [8.6840, 50.1090],
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Eiserner_Steg_Frankfurt.jpg/1200px-Eiserner_Steg_Frankfurt.jpg'
    }
];
