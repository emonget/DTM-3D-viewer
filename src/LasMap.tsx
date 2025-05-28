import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LasMapProps {
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  center: {
    latitude: number;
    longitude: number;
  };
}

export const LasMap: React.FC<LasMapProps> = ({ bounds, center }) => {
  const rectangleBounds: L.LatLngBoundsExpression = [
    [bounds.minLat, bounds.minLon],
    [bounds.maxLat, bounds.maxLon]
  ];

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={15}
      style={{ height: '400px', width: '100%', borderRadius: '0.5rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Rectangle
        bounds={rectangleBounds}
        pathOptions={{ color: 'blue', weight: 2, fillOpacity: 0.2 }}
      >
        <Popup>
          LAS Data Coverage Area<br />
          Center: {center.latitude.toFixed(6)}°, {center.longitude.toFixed(6)}°
        </Popup>
      </Rectangle>
    </MapContainer>
  );
}; 