import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle2, Clock, Filter, HeartHandshake, LocateFixed, MapPin, Plus, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import { normalizeApiError } from '../utils/errors';
import { timeAgo } from '../utils/timeUtils';
import { Badge, Button, EmptyState, ErrorState, IconButton, Skeleton, UrgencyBadge } from '../components/ui';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';

const CATEGORIES = ['BLOOD_DONATION', 'MEDICAL', 'FOOD', 'TRANSPORT', 'EMERGENCY', 'GENERAL'];
const URGENCIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const CATEGORY_LABELS = {
  BLOOD_DONATION: 'Blood',
  MEDICAL: 'Medical',
  FOOD: 'Food',
  TRANSPORT: 'Transport',
  EMERGENCY: 'Emergency',
  GENERAL: 'General',
};

function compactLocation(request) {
  return [request.address || request.location, request.city, request.district, request.state].filter(Boolean).slice(0, 2).join(', ') || 'Location shared after acceptance';
}

function requestMapPoint(request) {
  let lat = request.safeLatitude ?? request.mapLatitude ?? request.publicLatitude ?? request.latitude;
  let lng = request.safeLongitude ?? request.mapLongitude ?? request.publicLongitude ?? request.longitude;

  if (lat == null || lng == null) {
    if (request.location?.coordinates && Array.isArray(request.location.coordinates)) {
      // GeoJSON is [lng, lat]
      lng = request.location.coordinates[0];
      lat = request.location.coordinates[1];
    } else if (request.location?.x != null && request.location?.y != null) {
      lng = request.location.x;
      lat = request.location.y;
    }
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return [latitude, longitude];
}

function distanceKmBetween(left, right) {
  if (!left || !right) return null;
  const [lat1, lon1] = left.map(Number);
  const [lat2, lon2] = right.map(Number);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function canAccept(request, user) {
  const requesterId = request.requester?.id || request.requesterId || request.userId;
  const status = String(request.status || 'OPEN').toUpperCase();
  return user?.isVolunteer && status === 'OPEN' && String(requesterId) !== String(user?.userId || user?.id) && request.canAccept !== false;
}

function RequestCard({ request, user, onAccept, accepting }) {
  const location = compactLocation(request);
  const description = String(request.description || request.aiSummary || 'No description provided.').slice(0, 95);
  const helperSource = request.acceptedVolunteers || request.volunteers || request.helpers || [];
  const helperList = Array.isArray(helperSource) ? helperSource : [];
  const helpers = [request.requester, ...helperList].filter(Boolean).slice(0, 5);
  const helperCount = Number(request.helperCount ?? request.acceptedCount ?? request.volunteerCount ?? helpers.length) || helpers.length;
  return (
    <article className={`p7-request-card p7-request-card--${String(request.urgency || 'MEDIUM').toLowerCase()}`}>
      <div className="p7-request-card__accent" aria-hidden="true" />
      <div className="p7-request-card__top">
        <div className="p7-request-card__badges">
          <UrgencyBadge urgency={request.urgency} />
        </div>
        <span className="p7-request-card__time"><Clock size={15} /> {timeAgo(request.createdAtEpochMs || request.createdAt)}</span>
      </div>
      <h2>{request.title || 'Help request'}</h2>
      <p>{description}{description.length >= 95 ? '...' : ''}</p>
      <div className="p7-request-card__meta">
        <span className="p7-mini-chip">{CATEGORY_LABELS[request.category] || request.category || 'General'}</span>
        {request.community?.name && <span className="p7-mini-chip p7-mini-chip--blue">{request.community.name}</span>}
      </div>
      <div className="p7-request-card__meta p7-request-card__distance">
        {request.distanceKm != null && <span><LocateFixed size={16} /> {Number(request.distanceKm).toFixed(1)} km away</span>}
        {request.distanceKm == null && <span><MapPin size={16} /> {location}</span>}
      </div>
      {helperCount > 0 && (
        <div className="p7-helper-strip">
          <div className="p7-helper-avatars" aria-hidden="true">
            {helpers.map((helper, index) => (
              <span key={helper.id || helper.userId || helper.email || index}>
                {(helper.fullName || helper.name || helper.email || 'H').charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
          <small>{helperCount} helper{helperCount === 1 ? '' : 's'}</small>
        </div>
      )}
      <div className="p7-request-card__footer">
        <Button to={`/request/${request.id}`} variant="secondary">View Details</Button>
        {canAccept(request, user) && (
          <div>
          {canAccept(request, user) && (
            <Button type="button" onClick={() => onAccept(request)} loading={accepting === request.id}>
              <HeartHandshake size={16} /> Accept
            </Button>
          )}
          </div>
        )}
      </div>
    </article>
  );
}

function RecentActivity({ notifications = [], requests = [] }) {
  const notificationItems = notifications.slice(0, 6).map((notification) => ({
    id: `notification-${notification.id}`,
    title: notification.title || 'Sahay notification',
    detail: notification.message || '',
    time: notification.time || notification.createdAt,
    type: notification.read ? 'info' : 'urgent',
  }));
  const requestItems = requests.slice(0, 6).map((request) => ({
    id: `request-${request.id}`,
    title: `${CATEGORY_LABELS[request.category] || request.category || 'General'} request`,
    detail: `${CATEGORY_LABELS[request.category] || request.category || 'General'} request ${String(request.status || 'OPEN').toLowerCase()}`,
    time: request.updatedAt || request.createdAtEpochMs || request.createdAt,
    type: String(request.status || '').toUpperCase() === 'COMPLETED' ? 'success' : 'info',
  }));
  const items = notificationItems.length > 0 ? notificationItems : requestItems;

  return (
    <section className="p7-recent-activity" aria-label="Recent activity">
      <div className="p7-map-card__header">
        <h2>Recent Activity</h2>
      </div>
      <div className="p7-activity-list">
        {items.length === 0 ? (
          <div className="p7-activity-empty">No recent activity yet.</div>
        ) : items.map((item) => (
          <div key={item.id} className="p7-activity-item">
            <span className={`p7-activity-icon is-${item.type}`}>
              {item.type === 'success' ? <CheckCircle2 size={15} /> : item.type === 'urgent' ? <Bell size={15} /> : <Plus size={15} />}
            </span>
            <span>
              <strong>{item.title}</strong>
              {item.detail && <small>{item.detail}</small>}
              <time>{timeAgo(item.time)}</time>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <article className="p7-request-card p7-request-card--skeleton" aria-hidden="true">
      <div className="p7-request-card__accent" />
      <Skeleton lines={5} />
    </article>
  );
}

function MapAutoFit({ points, center, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (center && Number.isFinite(Number(radiusKm))) {
      const latRadius = Number(radiusKm) / 111;
      const lngRadius = latRadius / Math.max(0.2, Math.cos((center[0] * Math.PI) / 180));
      map.fitBounds([
        [center[0] - latRadius, center[1] - lngRadius],
        [center[0] + latRadius, center[1] + lngRadius],
      ], { padding: [28, 28], maxZoom: 13 });
      return;
    }
    const coords = points.filter(Boolean);
    if (coords.length > 1) {
      map.fitBounds(coords, { padding: [28, 28], maxZoom: 13 });
    } else if (coords[0]) {
      map.setView(coords[0], 12);
    }

  }, [map, points, center, radiusKm]);
  return null;
}

function mapIcon(color, className) {
  return L.divIcon({
    className: `p7-map-pin ${className}`,
    html: `<span style="background:${color}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function NearbyRequestMap({ requests, filters, user }) {
  const icons = useMemo(() => ({
    user: mapIcon('#168bff', 'is-user'),
    request: mapIcon('#ff6b00', 'is-request'),
    high: mapIcon('#ef4444', 'is-high'),
  }), []);
  const userCenter = Number.isFinite(Number(filters.latitude)) && Number.isFinite(Number(filters.longitude))
    ? [Number(filters.latitude), Number(filters.longitude)]
    : Number.isFinite(Number(user?.latitude)) && Number.isFinite(Number(user?.longitude))
      ? [Number(user.latitude), Number(user.longitude)]
      : null;
  const markers = requests
    .map((request) => {
      const point = requestMapPoint(request);
      return {
        request,
        point,
        distanceKm: request.distanceKm != null ? Number(request.distanceKm) : distanceKmBetween(userCenter, point),
      };
    })
    .filter((item) => item.point);
  const center = userCenter || markers[0]?.point || [28.6139, 77.2090];
  const radiusKm = [5, 10, 25, 50].includes(Number(filters.radiusKm)) ? Number(filters.radiusKm) : 10;
  const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');

  if (isJsdom) {
    return (
      <section className="p7-map-card" aria-label="Requests near you">
        <div className="p7-map-card__header">
          <div>
            <h2>Help Requests Near You</h2>
            <p>See nearby open help requests on the map.</p>
          </div>
          <Badge variant="info">{markers.length} mapped</Badge>
        </div>
        <div className="p7-request-map p7-request-map--static">
          {userCenter && <span>{radiusKm} km selected radius</span>}
          {markers.length === 0 ? 'No mapped open requests match these filters yet.' : markers.map(({ request }) => (
            <Link key={request.id} to={`/request/${request.id}`}>View Request</Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="p7-map-card" aria-label="Requests near you">
      <div className="p7-map-card__header">
        <div>
          <h2>Help Requests Near You</h2>
          <p>See nearby open help requests on the map.</p>
        </div>
        <Badge variant="info">{markers.length} mapped</Badge>
      </div>
      <MapContainer center={center} zoom={userCenter ? 12 : 10} className="p7-request-map" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        <MapAutoFit points={markers.map((item) => item.point)} center={userCenter} radiusKm={radiusKm} />
        {userCenter && (
          <>
            <Circle center={userCenter} radius={radiusKm * 1000} pathOptions={{ color: '#168bff', fillColor: '#168bff', fillOpacity: 0.05, weight: 2 }} />
            <Marker position={userCenter} icon={icons.user}>
              <Popup>Your location</Popup>
            </Marker>
          </>
        )}
        {markers.map(({ request, point, distanceKm }) => (
          <Marker
            key={request.id}
            position={point}
            icon={String(request.urgency || '').toUpperCase() === 'HIGH' || String(request.urgency || '').toUpperCase() === 'CRITICAL' || String(request.category || '').toUpperCase() === 'EMERGENCY' ? icons.high : icons.request}
          >
            <Popup>
              <div className="p7-map-popup">
                <strong>{request.title || 'Help request'}</strong>
                <span>{CATEGORY_LABELS[request.category] || request.category || 'General'} · {request.urgency || 'MEDIUM'}</span>
                <small>{compactLocation(request)}</small>
                {Number.isFinite(distanceKm) && <small>{distanceKm.toFixed(1)} km away</small>}
                <Link to={`/request/${request.id}`}>View Request</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="p7-map-legend" aria-label="Map legend">
        <span><i className="is-user" /> Your location</span>
        <span><i className="is-request" /> Request</span>
        <span><i className="is-high" /> High urgency</span>
        <span><i className="is-low" /> Low urgency</span>
      </div>
      {markers.length === 0 && <div className="p7-map-empty">No mapped open requests match these filters yet.</div>}
    </section>
  );
}

function FilterChip({ label, value, onRemove }) {
  return (
    <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`}>
      <span>{label}: {value}</span>
      <X size={14} aria-hidden="true" />
    </button>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const { notifications = [], showToast, notifyRequestAccepted } = useNotifications();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 901px)').matches
      : true
  ));
  const [accepting, setAccepting] = useState('');
  const [locationStatus, setLocationStatus] = useState('Use browser location or manual area filters for nearby results.');
  const [locationDenied, setLocationDenied] = useState(false);
  const [smartSearch, setSmartSearch] = useState({ query: '', results: [], available: false });
  const [filters, setFilters] = useState({
    search: '',
    radiusKm: '10',
    category: '',
    urgency: '',
    city: '',
    district: '',
    state: '',
    latitude: '',
    longitude: '',
  });

  const loadAll = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await apiService.getOpenRequests();
      const data = response.data;
      setRequests(Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []);
      setMode('all');
    } catch (err) {
      setError(normalizeApiError(err, 'Could not load help requests.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(min-width: 901px)');
    const syncFilters = () => setFiltersOpen(query.matches);
    syncFilters();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', syncFilters);
      return () => query.removeEventListener('change', syncFilters);
    }
    query.addListener(syncFilters);
    return () => query.removeListener(syncFilters);
  }, []);

  const baseFiltered = useMemo(() => {
    const center = Number.isFinite(Number(filters.latitude)) && Number.isFinite(Number(filters.longitude))
      ? [Number(filters.latitude), Number(filters.longitude)]
      : Number.isFinite(Number(user?.latitude)) && Number.isFinite(Number(user?.longitude))
        ? [Number(user.latitude), Number(user.longitude)]
        : null;
    const radiusKm = Number(filters.radiusKm || 10);
    return requests.filter((request) => {
      const matchesCategory = !filters.category || request.category === filters.category;
      const matchesUrgency = !filters.urgency || request.urgency === filters.urgency;
      const matchesCity = !filters.city || String(request.city || '').toLowerCase().includes(filters.city.toLowerCase());
      const matchesDistrict = !filters.district || String(request.district || '').toLowerCase().includes(filters.district.toLowerCase());
      const matchesState = !filters.state || String(request.state || '').toLowerCase().includes(filters.state.toLowerCase());
      const point = requestMapPoint(request);
      const distance = request.distanceKm != null ? Number(request.distanceKm) : distanceKmBetween(center, point);
      const matchesRadius = !center || !Number.isFinite(radiusKm) || 
        (Number.isFinite(distance) ? distance <= radiusKm : true);
      return matchesCategory && matchesUrgency && matchesCity && matchesDistrict && matchesState && matchesRadius;
    });
  }, [requests, filters, user?.latitude, user?.longitude]);

  useEffect(() => {
    const query = filters.search.trim();
    if (query.length < 2 || baseFiltered.length === 0) {
      setSmartSearch({ query, results: [], available: false });
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const candidates = baseFiltered.slice(0, 100).map((request) => ({
          id: request.id,
          title: request.title,
          description: request.description,
          category: request.category,
          status: request.status,
        }));
        const response = await apiService.smartSearchRequests(query, candidates);
        if (!active) return;
        const data = response.data || {};
        setSmartSearch({
          query,
          results: Array.isArray(data.results) ? data.results : [],
          available: Boolean(data.available),
        });
      } catch {
        if (active) setSmartSearch({ query, results: [], available: false });
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters.search, baseFiltered]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    if (!query) return baseFiltered;
    if (smartSearch.available && smartSearch.query.toLowerCase() === query && smartSearch.results.length > 0) {
      const rankById = new Map(smartSearch.results.map((item) => [String(item.requestId), item.rank]));
      return baseFiltered
        .filter((request) => rankById.has(String(request.id)))
        .sort((left, right) => rankById.get(String(left.id)) - rankById.get(String(right.id)));
    }
    return baseFiltered.filter((request) => [request.title, request.description, request.address, request.city, request.district, request.state]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [baseFiltered, filters.search, smartSearch]);

  const activeFilters = Object.entries(filters).filter(([key, value]) => (
    value && !['latitude', 'longitude'].includes(key) && !(key === 'radiusKm' && value === '10')
  ));

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const applyLocationFilterSuggestion = (suggestion) => {
    setFilters((current) => ({
      ...current,
      city: suggestion.city || current.city,
      district: suggestion.district || current.district,
      state: suggestion.state || current.state,
      latitude: Number.isFinite(suggestion.latitude) ? String(suggestion.latitude) : current.latitude,
      longitude: Number.isFinite(suggestion.longitude) ? String(suggestion.longitude) : current.longitude,
    }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Browser location is unavailable. Add city, district, or state manually.');
      return;
    }
    setLocationStatus('Requesting browser location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFilters((current) => ({
          ...current,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setLocationStatus('Location attached. Nearby search will use your approximate position.');
        setLocationDenied(false);
      },
      (geoError) => {
        setLocationStatus(geoError.code === geoError.PERMISSION_DENIED
          ? 'Location permission denied. Use city, district, or state filters instead.'
          : 'Location unavailable. Retry or use manual filters.');
        setLocationDenied(geoError.code === geoError.PERMISSION_DENIED);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const loadNearby = async () => {
    setMode('nearby');
    setRefreshing(true);
    setError(null);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const response = await apiService.getNearbyRequests(params);
      setRequests(Array.isArray(response.data) ? response.data : []);
      setLocationStatus('Showing nearby results from your chosen location filters.');
    } catch (err) {
      setRequests([]);
      setError(normalizeApiError(err, 'Could not load nearby requests.'));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({ search: '', radiusKm: '10', category: '', urgency: '', city: '', district: '', state: '', latitude: '', longitude: '' });
    setLocationDenied(false);
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) setFiltersOpen(false);
    loadAll();
  };

  const handleAccept = async (request) => {
    setAccepting(request.id);
    try {
      await apiService.acceptRequest(request.id, user);
      notifyRequestAccepted?.(request, user?.fullName);
      showToast({ type: 'success', title: 'Request accepted', message: 'The requester has been notified.' });
      await loadAll();
    } catch (err) {
      const normalized = normalizeApiError(err, 'Could not accept this request.');
      showToast({ type: 'error', title: 'Could not accept', message: normalized.message });
    } finally {
      setAccepting('');
    }
  };

  const filterPanel = (
    <div className="p7-filter-panel">
      <label className="p7-search-box">
        <Search size={18} aria-hidden="true" />
        <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search requests, locations, or descriptions" />
      </label>
      <select value={filters.radiusKm} onChange={(event) => updateFilter('radiusKm', event.target.value)} aria-label="Radius">
        {[5, 10, 25, 50].map((value) => <option key={value} value={value}>{value} km</option>)}
      </select>
      <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} aria-label="Category">
        <option value="">Any category</option>
        {CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
      </select>
      <select value={filters.urgency} onChange={(event) => updateFilter('urgency', event.target.value)} aria-label="Urgency">
        <option value="">Any urgency</option>
        {URGENCIES.map((urgency) => <option key={urgency} value={urgency}>{urgency}</option>)}
      </select>
      <LocationAutocompleteInput className="ui-input" value={filters.city} onValueChange={(value) => updateFilter('city', value)} onSuggestionSelect={applyLocationFilterSuggestion} type="CITY" placeholder="City" />
      <LocationAutocompleteInput className="ui-input" value={filters.district} onValueChange={(value) => updateFilter('district', value)} onSuggestionSelect={applyLocationFilterSuggestion} type="DISTRICT" placeholder="District" />
      <LocationAutocompleteInput className="ui-input" value={filters.state} onValueChange={(value) => updateFilter('state', value)} onSuggestionSelect={applyLocationFilterSuggestion} type="STATE" placeholder="State" />
      <Button type="button" variant="secondary" onClick={useCurrentLocation}><LocateFixed size={16} /> Use current location</Button>
      <Button type="button" onClick={loadNearby} loading={refreshing}>Find Nearby</Button>
      <Button type="button" variant="ghost" onClick={clearFilters}><RotateCcw size={16} /> Clear</Button>
    </div>
  );

  return (
    <div className="p7-feed">
      <section className="p7-feed-board">
        <div className="p7-feed-hero">
          <div>
            <span className="p7-feed-kicker">Help Feed / Nearby</span>
            <h1>Help Feed</h1>
            <p>Find and support real help requests in your community.</p>
          </div>
          <div className="p7-feed-hero__actions">
            <Button type="button" variant="secondary" onClick={loadNearby} loading={refreshing}><ShieldCheck size={16} /> Nearby</Button>
            <select value={filters.radiusKm} onChange={(event) => updateFilter('radiusKm', event.target.value)} aria-label="Radius">
              {[5, 10, 25, 50].map((value) => <option key={value} value={value}>Radius: {value} km</option>)}
            </select>
          </div>
        </div>

        <div className="p7-feed-actions-row">
          <Button to="/create"><Plus size={16} /> Raise a Request</Button>
          <label className="p7-search-box">
            <Search size={18} aria-hidden="true" />
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search requests..." />
          </label>
          <IconButton label="Open filters" className="p7-filter-toggle" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            <Filter size={18} />
          </IconButton>
        </div>

        {filtersOpen && (
          <aside className="p7-feed-filters" aria-label="Request filters">
            <div className="p7-panel-title">
              <strong>Filters</strong>
              <button type="button" onClick={clearFilters}>Clear all</button>
            </div>
            {filterPanel}
          </aside>
        )}

        <div className="p7-feed-results">
          {activeFilters.length > 0 && (
            <div className="p7-filter-chips">
              {activeFilters.map(([key, value]) => (
                <FilterChip key={key} label={key} value={value} onRemove={() => updateFilter(key, key === 'radiusKm' ? '10' : '')} />
              ))}
            </div>
          )}

          {locationDenied && (
            <div className="p7-location-denied" role="status">
              <AlertTriangle size={18} />
              <div>
                <strong>Location permission is blocked</strong>
                <p>Use city, district, or state filters for nearby help, retry browser location, or continue with all requests.</p>
              </div>
              <Button type="button" variant="secondary" onClick={useCurrentLocation}>Retry location</Button>
              <Button type="button" variant="ghost" onClick={loadAll}>Continue without location</Button>
            </div>
          )}

          {loading ? (
            <div className="p7-request-list">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : error ? (
            <ErrorState title="Could not load requests" message={error.message} onRetry={mode === 'nearby' ? loadNearby : loadAll} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={mode === 'nearby' ? 'No nearby requests found' : 'No requests match your filters'}
              message="Try widening your area, clearing filters, or raising a request if you need help."
              actionLabel="Raise Request"
              actionTo="/create"
            />
          ) : (
            <div className="p7-request-list">
              {filtered.map((request) => (
                <RequestCard key={request.id} request={request} user={user} onAccept={handleAccept} accepting={accepting} />
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="p7-feed-bottom-grid">
        <NearbyRequestMap requests={filtered} filters={filters} user={user} />
        <RecentActivity notifications={notifications} requests={filtered} />
      </section>
    </div>
  );
}
