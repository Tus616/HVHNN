import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Navigation, CheckCircle2, Map as MapIcon, ArrowRight } from 'lucide-react';

// Custom Map Updater Component to recount bounds on new route
function UpdateMapBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [map, positions]);
  return null;
}

// Custom DivIcons
const volunteerIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: '<div class="volunteer-marker"><div class="marker-pulse"></div></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const requesterIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: '<div class="requester-marker"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function VolunteerNavigationMap({ request, onClose, onArrived }) {
  const [currentPos, setCurrentPos] = useState(null);
  const [route, setRoute] = useState(null);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reqLat = request?.latitude;
  const reqLng = request?.longitude;
  
  const timerRef = useRef(null);

  useEffect(() => {
    if (!reqLat || !reqLng) {
      setError("Requester location not found.");
      setLoading(false);
      return;
    }

    const fetchLocationAndRoute = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: volLat, longitude: volLng } = position.coords;
          setCurrentPos({ lat: volLat, lng: volLng });
          setError(null);

          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${volLng},${volLat};${reqLng},${reqLat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.routes && data.routes[0]) {
              const routeData = data.routes[0];
              // GeoJSON provides coordinates in [lng, lat], Leaflet expects [lat, lng]
              const routeCoords = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);
              setRoute(routeCoords);
              
              // Formatting Distance
              const distanceMeters = routeData.distance;
              if (distanceMeters > 1000) {
                setDistance(`${(distanceMeters / 1000).toFixed(1)} km`);
              } else {
                setDistance(`${Math.round(distanceMeters)} m`);
              }

              // Formatting ETA
              const durationSecs = routeData.duration;
              const durationMins = Math.ceil(durationSecs / 60);
              setEta(`~${durationMins} min by road`);
            }
          } catch (err) {
            console.error("OSRM Routing Error:", err);
            // Fallback route line if routing fails
            setRoute([[volLat, volLng], [reqLat, reqLng]]);
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error("Geolocation error:", err);
          setError(err.code === 1 ? "Location access denied. Please enable GPS." : "Failed to fetch GPS location.");
          setLoading(false);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    };

    // Initial Fetch
    fetchLocationAndRoute();

    // Setup 30s interval
    timerRef.current = setInterval(fetchLocationAndRoute, 30000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reqLat, reqLng]);

  const fallbackGoogleMapsUrl = currentPos
    ? `https://www.google.com/maps/dir/${currentPos.lat},${currentPos.lng}/${reqLat},${reqLng}`
    : `https://www.google.com/maps?q=${reqLat},${reqLng}`;

  return (
    <div className="map-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="map-modal-container">
        
        {/* Top Info Bar */}
        <div className="map-info-bar">
          <div style={{ flex: 1 }}>
            <h3 className="map-title text-black">Navigating to Requester</h3>
            {distance && eta && !error && (
              <div className="map-stats">
                <span className="map-badge badge-distance">📍 {distance}</span>
                <span className="map-badge badge-eta">⏱️ {eta}</span>
              </div>
            )}
            {error && <div className="text-sm" style={{color: '#ef4444', fontWeight: 600, marginTop: '4px'}}>{error}</div>}
          </div>
          
          <button className="map-close-btn" onClick={onClose} title="Close Map">
            <X size={22} />
          </button>
        </div>

        {/* Map Area */}
        <div className="map-render-area">
          {loading ? (
            <div className="map-loading-state">
              <div className="spinner" />
              <p>Acquiring GPS Signal...</p>
            </div>
          ) : (
            <MapContainer 
              center={currentPos || [reqLat, reqLng]} 
              zoom={14} 
              style={{ height: '100%', width: '100%', zIndex: 1 }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                className="map-tiles"
              />
              
              {currentPos && (
                <Marker position={[currentPos.lat, currentPos.lng]} icon={volunteerIcon}>
                  <Popup>
                    <strong>You are here</strong>
                  </Popup>
                </Marker>
              )}

              {reqLat && reqLng && (
                <Marker position={[reqLat, reqLng]} icon={requesterIcon}>
                  <Popup>
                    <strong>Help needed here</strong><br/>
                    {request.requester?.fullName || 'Requester'}
                  </Popup>
                </Marker>
              )}

              {route && (
                <>
                  <Polyline positions={route} pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.8 }} />
                  <UpdateMapBounds positions={route} />
                </>
              )}
            </MapContainer>
          )}

          {error && currentPos && (
             <div className="map-error-overlay p-4 bg-red-50 absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
                <MapIcon size={48} className="text-red-400 mb-4" />
                <h3 className="text-lg font-bold text-red-900 mb-2">Location Required</h3>
                <p className="text-red-700 max-w-sm mb-6">We need your location to provide live routing. You can use external maps instead.</p>
             </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="map-actions-bar">
          {error ? (
            <a href={fallbackGoogleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
              <Navigation size={18} />
              Open in Google Maps
            </a>
          ) : (
            <button 
              className="btn btn-success" 
              style={{ flex: 1, justifyContent: 'center', fontSize: '1.1rem', padding: '14px' }}
              onClick={() => onArrived(request.id)}
            >
              <CheckCircle2 size={24} />
              I've Arrived
            </button>
          )}
          
          <a 
            href={fallbackGoogleMapsUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-secondary btn-icon"
            title="External Directions"
          >
            <ArrowRight size={20} />
          </a>
        </div>
      </div>
    </div>
  );
}
