import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

// Fix marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

function FitBounds({ userLocation, products }) {
  const map = useMap();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    if (!mountedRef.current) return;
    if (!map || !map.getContainer()) return;

    try {
      const bounds = L.latLngBounds([[userLocation.lat, userLocation.lng]]);

      products.forEach((p) => {
        if (p.location?.coordinates) {
          const [lng, lat] = p.location.coordinates;
          bounds.extend([lat, lng]);
        }
      });

      if (bounds.isValid() && mountedRef.current) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch {
      // Map was destroyed mid-flight — silently ignore
    }
  }, [userLocation, products, map]);

  return null;
}

function MapView({ userLocation, products }) {
  if (!userLocation) return null;

  // Normalise: accept both {lat,lng} object and [lat,lng] array
  const center = Array.isArray(userLocation)
    ? userLocation
    : [userLocation.lat, userLocation.lng];

  // ✅ key forces MapContainer to fully remount when the user's location
  //    changes. Without this, React reuses the old DOM node and Leaflet's
  //    internal layer-removal calls crash on the stale (null) map reference.
  const mapKey = `${center[0]}-${center[1]}`;

  return (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={13}
      style={{ height: "400px", marginTop: "20px" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 👤 User Marker */}
      <Marker position={center}>
        <Popup>📍 You are here</Popup>
      </Marker>

      {/* 🏬 Product / Store Markers */}
      {products.map((product) => {
        if (!product.location?.coordinates) return null;
        const [lng, lat] = product.location.coordinates;

        return (
          <Marker key={product._id} position={[lat, lng]}>
            <Popup>
              <strong>{product.name}</strong>
              <br />
              ₹{product.price?.toLocaleString("en-IN")}
              <br />
              {product.distance != null
                ? `${(product.distance / 1000).toFixed(2)} km away`
                : ""}
            </Popup>
          </Marker>
        );
      })}

      <FitBounds userLocation={userLocation} products={products} />
    </MapContainer>
  );
}

export default MapView;