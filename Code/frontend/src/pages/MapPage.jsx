import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Crosshair, MapPin, RefreshCw, Search } from 'lucide-react';
import { mapsApi } from '../api';
import { errorMessage } from '../api/client';
import { useAsync } from '../lib/useAsync';
import { STATUS, STATUSES, fmtCoord, fmtDate, humanize } from '../lib/format';
import { Alert, EmptyState, ErrorState, Field, Loading, PageHeader, Spinner, StatusBadge } from '../components/ui';

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const DEFAULT_CENTER = [21.25, 81.63]; // Raipur
const REFRESH_MS = 30000;

// Colour-coded pin per operational status (divIcon avoids Leaflet's default-icon bundler issue).
const iconCache = {};
const pin = (status, selected) => {
  const key = `${status}-${selected}`;
  return (iconCache[key] ||= L.divIcon({
    className: `fleet-marker${selected ? ' selected' : ''}`,
    html: `<span style="background:${STATUS[status]?.color || '#94a3b8'}"></span>`,
    iconSize: [28, 28], iconAnchor: [14, 26], popupAnchor: [0, -24],
  }));
};
const centerIcon = L.divIcon({ className: 'fleet-marker', html: '<span style="background:#dc2626;border-radius:50%;transform:none;width:16px;height:16px;margin:6px"></span>', iconSize: [28, 28] });

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target.pos, target.zoom ?? Math.max(map.getZoom(), 11), { duration: 0.8 }); }, [target, map]);
  return null;
}
function FitAll({ points, enabled }) {
  const map = useMap();
  useEffect(() => { if (enabled && points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 12 }); }, [enabled]); // eslint-disable-line
  return null;
}
function ClickToPick({ active, onPick }) {
  useMapEvents({ click: (e) => active && onPick(e.latlng) });
  return null;
}

export default function MapPage() {
  const { data, loading, error, reload } = useAsync(async () => (await mapsApi.locations()).data, []);
  const [selectedId, setSelectedId] = useState(null);
  const [fly, setFly] = useState(null);
  const [filter, setFilter] = useState('');
  const [auto, setAuto] = useState(true);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState({ latitude: '21.2514', longitude: '81.6296', radius: '50' });
  const [nearby, setNearby] = useState(null); // { center, radius, results }
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(() => reload(true), REFRESH_MS); // silent refresh: markers update without a spinner
    return () => clearInterval(t);
  }, [auto, reload]);

  const vehicles = useMemo(() => (data || []).filter((v) => !filter || v.operationalStatus === filter), [data, filter]);
  const selected = (data || []).find((v) => v.vehicleId === selectedId);
  const allPoints = useMemo(() => (data || []).map((v) => [v.location.latitude, v.location.longitude]), [data]);

  const select = (v) => { setSelectedId(v.vehicleId); setFly({ pos: [v.location.latitude, v.location.longitude], zoom: 12, k: Date.now() }); };

  const search = async (e) => {
    e.preventDefault();
    setSearchError(''); setSearching(true);
    try {
      const res = await mapsApi.nearby(q.latitude, q.longitude, q.radius); // distances come from the backend Haversine implementation
      const center = [parseFloat(q.latitude), parseFloat(q.longitude)];
      setNearby({ center, radius: parseFloat(q.radius), results: res.data });
      setFly({ pos: center, zoom: 9, k: Date.now() });
    } catch (err) { setSearchError(errorMessage(err)); setNearby(null); }
    setSearching(false);
  };

  if (loading && !data) return <Loading label="Loading vehicle locations…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Live vehicle map" subtitle={`${data.length} vehicle${data.length === 1 ? '' : 's'} with GPS coordinates`}
        actions={<>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh (30 s)</label>
          <button className="btn-secondary" onClick={() => reload(true)}><RefreshCw className="h-4 w-4" /> Refresh</button>
        </>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card self-start overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5 text-xs">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setFilter(filter === s ? '' : s)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ring-inset ${filter === s ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[s].color }} />{STATUS[s].label}
              </button>
            ))}
            {error && <span className="text-red-600">Refresh failed: {error}</span>}
          </div>
          <MapContainer center={DEFAULT_CENTER} zoom={7} scrollWheelZoom style={{ height: '62vh', minHeight: 420 }} className={picking ? 'cursor-crosshair' : ''}>
            <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
            <FitAll points={allPoints} enabled={allPoints.length > 0} />
            <FlyTo target={fly} />
            <ClickToPick active={picking} onPick={(ll) => { setQ((p) => ({ ...p, latitude: ll.lat.toFixed(5), longitude: ll.lng.toFixed(5) })); setPicking(false); }} />
            {vehicles.map((v) => (
              <Marker key={v.vehicleId} position={[v.location.latitude, v.location.longitude]} icon={pin(v.operationalStatus, v.vehicleId === selectedId)}
                eventHandlers={{ click: () => setSelectedId(v.vehicleId) }}>
                <Popup>
                  <div className="min-w-[180px] text-sm">
                    <p className="text-base font-semibold">{v.registrationNumber}</p>
                    <div className="my-1"><StatusBadge status={v.operationalStatus} /></div>
                    <p className="text-slate-600">{humanize(v.vehicleType)} · {v.vehicleId}</p>
                    <p className="text-slate-600">{fmtCoord(v.location.latitude)}, {fmtCoord(v.location.longitude)}</p>
                    {v.address && <p className="text-xs text-slate-500">{v.address}</p>}
                    <Link to={`/vehicles/${v.vehicleId}`} className="mt-1 inline-block text-brand-600 hover:underline">View details →</Link>
                  </div>
                </Popup>
              </Marker>
            ))}
            {nearby && <>
              <Circle center={nearby.center} radius={nearby.radius * 1000} pathOptions={{ color: '#4f46e5', weight: 2, fillOpacity: 0.06 }} />
              <Marker position={nearby.center} icon={centerIcon}><Popup>Search centre</Popup></Marker>
            </>}
          </MapContainer>
        </div>

        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Nearby vehicle search</h2>
            <form onSubmit={search} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude"><input className="input" type="number" step="any" required value={q.latitude} onChange={(e) => setQ({ ...q, latitude: e.target.value })} /></Field>
                <Field label="Longitude"><input className="input" type="number" step="any" required value={q.longitude} onChange={(e) => setQ({ ...q, longitude: e.target.value })} /></Field>
              </div>
              <Field label="Radius (km)"><input className="input" type="number" step="any" min="0.1" required value={q.radius} onChange={(e) => setQ({ ...q, radius: e.target.value })} /></Field>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={searching}>{searching ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />} Search</button>
                <button type="button" className={picking ? 'btn-primary' : 'btn-secondary'} onClick={() => setPicking(!picking)} title="Click on the map to set the centre"><Crosshair className="h-4 w-4" /> {picking ? 'Click map…' : 'Pick'}</button>
              </div>
            </form>
            {searchError && <div className="mt-3"><Alert>{searchError}</Alert></div>}
            {nearby && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-slate-500">{nearby.results.length} vehicle{nearby.results.length === 1 ? '' : 's'} within {nearby.radius} km (distance from backend Haversine)</p>
                {nearby.results.length === 0 ? <EmptyState icon={MapPin} title="No vehicles in range" hint="Try a larger radius or a different centre." /> : (
                  <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                    {nearby.results.map(({ vehicle: v, distance }) => (
                      <li key={v.vehicleId}>
                        <button onClick={() => select(v)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50">
                          <span><span className="block text-sm font-medium">{v.registrationNumber}</span><span className="block text-xs text-slate-500">{fmtCoord(v.location.latitude)}, {fmtCoord(v.location.longitude)}</span></span>
                          <span className="text-right"><span className="block text-sm font-semibold text-brand-700">{distance.toFixed(2)} km</span><StatusBadge status={v.operationalStatus} /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Vehicle information</h2>
            {!selected ? <p className="text-sm text-slate-500">Select a marker or a vehicle below to see its details.</p> : (
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between"><dt className="text-lg font-semibold">{selected.registrationNumber}</dt><StatusBadge status={selected.operationalStatus} /></div>
                <div className="flex justify-between"><dt className="text-slate-500">Vehicle ID</dt><dd>{selected.vehicleId}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Type</dt><dd>{humanize(selected.vehicleType)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">GPS</dt><dd>{fmtCoord(selected.location.latitude)}, {fmtCoord(selected.location.longitude)}</dd></div>
                {selected.address && <div className="flex justify-between gap-3"><dt className="text-slate-500">Address</dt><dd className="text-right">{selected.address}</dd></div>}
                <Link to={`/vehicles/${selected.vehicleId}`} className="inline-block pt-1 text-brand-600 hover:underline">Open full details →</Link>
              </dl>
            )}
          </section>

          <section className="card">
            <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">Vehicles ({vehicles.length})</h2>
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
              {vehicles.map((v) => (
                <li key={v.vehicleId}>
                  <button onClick={() => select(v)} className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50 ${v.vehicleId === selectedId ? 'bg-brand-50' : ''}`}>
                    <span className="font-medium">{v.registrationNumber}</span><StatusBadge status={v.operationalStatus} />
                  </button>
                </li>
              ))}
              {vehicles.length === 0 && <li className="p-4 text-sm text-slate-500">No vehicles match the filter.</li>}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
