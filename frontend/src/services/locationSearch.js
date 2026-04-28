const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchLocationSuggestions(query, signal) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    format: 'json',
    limit: '5',
    addressdetails: '1',
  });

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error('Location suggestions are unavailable right now.');
  }

  const results = await response.json();
  return Array.isArray(results)
    ? results.map((result) => ({
        placeId: result.place_id,
        displayName: result.display_name,
        latitude: Number(result.lat),
        longitude: Number(result.lon),
        type: result.type,
        address: result.address || {},
      }))
    : [];
}
