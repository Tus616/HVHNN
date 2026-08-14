import apiService from './api';

export async function searchLocationSuggestions(query, signal, type = '') {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) {
    return [];
  }

  try {
    const response = await apiService.searchLocations(trimmedQuery, type, { signal });
    const results = response.data;
    
    return Array.isArray(results)
      ? results.map((result) => ({
          placeId: result.placeId,
          displayName: result.displayName,
          latitude: Number(result.latitude),
          longitude: Number(result.longitude),
          type: result.type,
          address: result.address || {},
          city: result.city || '',
          district: result.district || '',
          state: result.state || '',
          country: result.country || '',
        }))
      : [];
  } catch (error) {
    if (error.name === 'CanceledError' || error.name === 'AbortError') {
      throw error;
    }
    throw new Error('Location suggestions are unavailable right now.');
  }
}
