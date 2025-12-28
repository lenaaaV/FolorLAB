/**
 * Fetches places and POIs within the given map bounds.
 * @param {Object} bounds - The map bounds object { _sw: { lng, lat }, _ne: { lng, lat } }
 * @returns {Promise<Object>} - Object containing { places: [], pois: [] }
 */
export const fetchPlacesInBounds = async (bounds) => {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Construct Overpass QL query
    // Fetch places (nodes) AND interesting POIs (nodes, ways, relations)
    // Use 'center' to get coordinates for ways/relations
    const query = `
        [out:json][timeout:25];
        (
          // Places
          node["place"~"city|town|village|hamlet"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          
          // POIs: Churches, Townhalls
          node["amenity"~"place_of_worship|townhall"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["amenity"~"place_of_worship|townhall"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          
          // POIs: Transport
          node["public_transport"="station"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          
          // POIs: Tourism (Sights, Museums, Viewpoints)
          node["tourism"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["tourism"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          
          // POIs: Leisure (Parks, Gardens)
          node["leisure"~"park|garden"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["leisure"~"park|garden"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          
          // POIs: Historic
          node["historic"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
          way["historic"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
        );
        out center;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.statusText}`);
        }

        const data = await response.json();
        const places = [];
        const pois = [];

        data.elements.forEach(element => {
            const tags = element.tags || {};
            const lat = element.lat || element.center?.lat;
            const lon = element.lon || element.center?.lon;

            if (!lat || !lon) return;

            if (tags.place && ['city', 'town', 'village', 'hamlet'].includes(tags.place)) {
                places.push({
                    id: element.id,
                    type: tags.place,
                    name: tags.name || 'Unbekannter Ort',
                    population: parseInt(tags.population, 10) || 0,
                    lat,
                    lon
                });
            } else {
                // It's a POI
                let type = 'poi';
                if (tags.amenity === 'place_of_worship') type = 'church';
                if (tags.amenity === 'townhall') type = 'townhall';
                if (tags.leisure === 'park' || tags.leisure === 'garden') type = 'park';
                if (tags.public_transport === 'station') type = 'station';
                if (tags.tourism) type = 'sight';
                if (tags.historic) type = 'historic';

                pois.push({
                    id: element.id,
                    type,
                    name: tags.name || tags.description || 'Sehenswürdigkeit',
                    lat,
                    lon
                });
            }
        });

        return { places, pois };

    } catch (error) {
        console.error('Error fetching data from Overpass:', error);
        return { places: [], pois: [] };
    }
};
