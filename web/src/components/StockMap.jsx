import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/format';
import { usePrefs } from '../lib/i18n';

function Fit({ points }) {
  const map = useMap();
  useEffect(() => { if (points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 }); }, [points.length]); // eslint-disable-line
  return null;
}

// `depots`: [{ shopName, neighborhood, location:{lat,lng}, currentStockCount, status|riskLevel, empties? }]
export default function StockMap({ depots, mode = 'stock', height = 460 }) {
  const { t, theme } = usePrefs();
  const placed = depots.filter((d) => d.location && d.location.lat != null);
  const points = placed.map((d) => [d.location.lat, d.location.lng]);
  return (
    <MapContainer center={[3.866, 11.517]} zoom={12} style={{ height }} className="map" scrollWheelZoom>
      <TileLayer key={theme} attribution="&copy; OpenStreetMap contributors &copy; CARTO" url={`https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`} />
      <Fit points={points} />
      {placed.map((d) => {
        const level = d.riskLevel || d.status;
        const color = mode === 'empties' ? '#1F7AE0' : STATUS_COLOR[level] || '#6B7F8C';
        const value = mode === 'empties' ? d.empties || 0 : d.currentStockCount;
        const radius = mode === 'empties' ? 6 + Math.min(18, (d.empties || 0) * 1.4) : 8 + Math.min(14, value * 0.7);
        return (
          <CircleMarker key={d.depotId || d._id} center={[d.location.lat, d.location.lng]} radius={radius}
            pathOptions={{ color: theme === 'dark' ? '#E6F0F5' : '#0E2230', weight: level === 'OUT' || level === 'CRITICAL' ? 3 : 1.5, fillColor: color, fillOpacity: 0.85 }}>
            <Tooltip direction="top">
              <strong>{d.shopName}</strong><br />{d.neighborhood}<br />
              {mode === 'empties' ? t('{n} empty shells', { n: value }) : `${t('{n} full bottles', { n: value })} · ${t(STATUS_LABEL[level] || level)}`}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
