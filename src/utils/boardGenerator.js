
/**
 * Simple deterministic random number generator.
 * @param {number} seed 
 * @returns {function} - Returns a random number between 0 and 1
 */
const mulberry32 = (seed) => {
    return () => {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

/**
 * Generates MemoryBoard locations for a given place based on population rules and available POIs.
 * @param {Object} place - The place object
 * @param {Array} availablePois - Array of all fetched POIs
 * @returns {Array} - Array of board objects
 */
export const generateBoardsForPlace = (place, availablePois) => {
    const boards = [];
    const seed = place.id;
    const random = mulberry32(seed);

    let numBoards = 0;
    let radius = 0.005; // Default radius ~500m

    // Determine number of boards based on rules
    if (place.type === 'village' || place.type === 'hamlet' || (place.population > 0 && place.population < 2000)) {
        numBoards = 1 + Math.floor(random() * 2); // 1 to 2
        radius = 0.015; // ~1.5km (Villages are spread out)
    }
    else if (place.population >= 2000 && place.population < 10000) {
        numBoards = 3 + Math.floor(random() * 4); // 3 to 6
        radius = 0.03; // ~3km
    }
    else if (place.population >= 10000 && place.population < 50000) {
        numBoards = 15 + Math.floor(random() * 11); // 15 to 25
        radius = 0.05; // ~5km
    }
    else if (place.population >= 50000 && place.population < 100000) {
        numBoards = 50 + Math.floor(random() * 31); // 50 to 80
        radius = 0.08; // ~8km
    }
    else if (place.population >= 100000) {
        numBoards = Math.floor(place.population / 2500);
        numBoards = Math.min(numBoards, 150);
        radius = 0.12; // ~12km
    }
    else {
        // Fallback
        if (place.type === 'city') { numBoards = 20; radius = 0.05; }
        else if (place.type === 'town') { numBoards = 5; radius = 0.02; }
        else { numBoards = 1; radius = 0.01; }
    }

    // Filter POIs within radius
    const nearbyPois = availablePois.filter(poi => {
        const dLat = Math.abs(poi.lat - place.lat);
        const dLon = Math.abs(poi.lon - place.lon);
        return dLat < radius && dLon < radius; // Simple box check first
    });

    // Sort POIs by "importance" for this place type
    // Villages: Churches/Townhalls first
    // Cities: Sights/Parks first
    nearbyPois.sort((a, b) => {
        const scoreA = getPoiScore(a, place.type);
        const scoreB = getPoiScore(b, place.type);
        return scoreB - scoreA; // Descending
    });

    // Select top N POIs
    const selectedPois = nearbyPois.slice(0, numBoards);

    // If no POIs found, fallback to place center
    if (selectedPois.length === 0) {
        boards.push({
            id: `gen-${place.id}-center`,
            name: `${place.name} Zentrum`,
            coordinates: [place.lon, place.lat],
            image: null,
            isGenerated: true
        });
    } else {
        selectedPois.forEach(poi => {
            boards.push({
                id: `gen-poi-${poi.id}`,
                name: poi.name,
                coordinates: [poi.lon, poi.lat],
                image: null,
                isGenerated: true,
                poiType: poi.type
            });
        });
    }

    return boards;
};

const getPoiScore = (poi, placeType) => {
    let score = 0;
    // Base scores
    if (poi.type === 'church') score += 10;
    if (poi.type === 'townhall') score += 9;
    if (poi.type === 'sight') score += 8;
    if (poi.type === 'park') score += 7;
    if (poi.type === 'station') score += 6;

    // Context adjustments
    if (placeType === 'village' && (poi.type === 'church' || poi.type === 'townhall')) {
        score += 5; // Boost village centers
    }

    return score;
};
