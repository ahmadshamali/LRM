import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection } from 'geojson';
import {
  getAnalyticsKpis,
  getApplicationsByStatus,
  getApplicationsByType,
  getApplicationsByZone,
  getApplicationsCsvUrl,
  getParcelsGeoFeed,
  getPendingHeatmapGeoFeed,
  getProcessingTime,
  getRegistrarAnalytics,
  getSurveyorAnalytics,
} from './api';
import type {
  AnalyticsKpis,
  GeoJsonFeatureCollection,
  ProcessingTimeRecord,
  RegistrarAnalytics,
  StatusCount,
  SurveyorAnalytics,
  TypeCount,
  ZoneCount,
} from './types';

const emptyKpis: AnalyticsKpis = {
  total_applications: 0,
  pending_applications: 0,
  approved_applications: 0,
  rejected_applications: 0,
  under_objection_applications: 0,
  certificates_issued: 0,
  average_processing_days: null,
};

function displayValue(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return String(value);
}

function escapeHtml(value: unknown): string {
  return displayValue(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function uniqueOptions(feed: GeoJsonFeatureCollection, propertyName: string): string[] {
  const values = feed.features
    .map((feature) => feature.properties[propertyName])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(String);

  return Array.from(new Set(values)).sort((first, second) => first.localeCompare(second));
}

function BarList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section className="analytics-panel">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">No records</p>
      ) : (
        <div className="bar-list">
          {rows.map((row) => (
            <div className="bar-row" key={row.label}>
              <span>{row.label}</span>
              <div>
                <i style={{ width: `${Math.max(4, (row.count / maxCount) * 100)}%` }} />
              </div>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AnalyticsMap({
  parcels,
  pendingHeatmap,
}: {
  parcels: GeoJsonFeatureCollection;
  pendingHeatmap: GeoJsonFeatureCollection;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const parcelLayerRef = useRef<L.GeoJSON | null>(null);
  const pendingLayerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapElementRef.current).setView([31.9, 35.2], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (parcelLayerRef.current) {
      parcelLayerRef.current.remove();
    }
    if (pendingLayerRef.current) {
      pendingLayerRef.current.remove();
    }

    parcelLayerRef.current = L.geoJSON(parcels as unknown as FeatureCollection, {
      style: {
        color: '#315c3b',
        fillColor: '#8fae6f',
        fillOpacity: 0.3,
        weight: 2,
      },
      onEachFeature: (feature, layer) => {
        const properties = feature.properties ?? {};
        layer.bindPopup(
          `<strong>Parcel ${escapeHtml(properties.parcel_number)}</strong><br>` +
            `Zone: ${escapeHtml(properties.zone_id)}<br>` +
            `Status: ${escapeHtml(properties.registration_status)}<br>` +
            `Dispute: ${escapeHtml(properties.dispute_state)}`,
        );
      },
    }).addTo(map);

    pendingLayerRef.current = L.geoJSON(pendingHeatmap as unknown as FeatureCollection, {
      style: {
        color: '#9a6a16',
        fillColor: '#d9b45d',
        fillOpacity: 0.44,
        weight: 3,
      },
      onEachFeature: (feature, layer) => {
        const properties = feature.properties ?? {};
        layer.bindPopup(
          `<strong>Pending application</strong><br>` +
            `Application: ${escapeHtml(properties.application_id)}<br>` +
            `Type: ${escapeHtml(properties.application_type)}<br>` +
            `Status: ${escapeHtml(properties.status)}<br>` +
            `Zone: ${escapeHtml(properties.zone_id)}`,
        );
      },
    }).addTo(map);

    const bounds = parcelLayerRef.current.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [18, 18], maxZoom: 16 });
    } else {
      map.setView([31.9, 35.2], 10);
    }

    setTimeout(() => map.invalidateSize(), 0);
  }, [parcels, pendingHeatmap]);

  return <div className="analytics-map" ref={mapElementRef} />;
}

function AnalyticsPage() {
  const [kpis, setKpis] = useState<AnalyticsKpis>(emptyKpis);
  const [statusRows, setStatusRows] = useState<StatusCount[]>([]);
  const [typeRows, setTypeRows] = useState<TypeCount[]>([]);
  const [zoneRows, setZoneRows] = useState<ZoneCount[]>([]);
  const [processingRows, setProcessingRows] = useState<ProcessingTimeRecord[]>([]);
  const [surveyors, setSurveyors] = useState<SurveyorAnalytics[]>([]);
  const [registrars, setRegistrars] = useState<RegistrarAnalytics[]>([]);
  const [parcels, setParcels] = useState<GeoJsonFeatureCollection>({ type: 'FeatureCollection', features: [] });
  const [pendingHeatmap, setPendingHeatmap] = useState<GeoJsonFeatureCollection>({ type: 'FeatureCollection', features: [] });
  const [filters, setFilters] = useState({ zone_id: '', registration_status: '', dispute_state: '' });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadAnalytics() {
    setLoading(true);
    setErrorMessage('');

    try {
      const [
        loadedKpis,
        loadedStatusRows,
        loadedTypeRows,
        loadedZoneRows,
        loadedProcessingRows,
        loadedSurveyors,
        loadedRegistrars,
        loadedParcels,
        loadedPendingHeatmap,
      ] = await Promise.all([
        getAnalyticsKpis(),
        getApplicationsByStatus(),
        getApplicationsByType(),
        getApplicationsByZone(),
        getProcessingTime(),
        getSurveyorAnalytics(),
        getRegistrarAnalytics(),
        getParcelsGeoFeed(),
        getPendingHeatmapGeoFeed(),
      ]);

      setKpis(loadedKpis);
      setStatusRows(loadedStatusRows);
      setTypeRows(loadedTypeRows);
      setZoneRows(loadedZoneRows);
      setProcessingRows(loadedProcessingRows);
      setSurveyors(loadedSurveyors);
      setRegistrars(loadedRegistrars);
      setParcels(loadedParcels);
      setPendingHeatmap(loadedPendingHeatmap);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load analytics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const filteredParcels = useMemo<GeoJsonFeatureCollection>(() => {
    const features = parcels.features.filter((feature) =>
      Object.entries(filters).every(([key, value]) => !value || String(feature.properties[key] ?? '') === value),
    );
    return { type: 'FeatureCollection', features };
  }, [filters, parcels]);

  const filteredPendingHeatmap = useMemo<GeoJsonFeatureCollection>(() => {
    const features = pendingHeatmap.features.filter((feature) =>
      Object.entries(filters).every(([key, value]) => !value || String(feature.properties[key] ?? '') === value),
    );
    return { type: 'FeatureCollection', features };
  }, [filters, pendingHeatmap]);

  const kpiCards = [
    ['Total applications', kpis.total_applications],
    ['Pending', kpis.pending_applications],
    ['Approved', kpis.approved_applications],
    ['Rejected', kpis.rejected_applications],
    ['Under objection', kpis.under_objection_applications],
    ['Certificates issued', kpis.certificates_issued],
    ['Avg. processing days', kpis.average_processing_days ?? '-'],
  ];

  return (
    <section className="card analytics-page">
      <div className="analytics-header">
        <div>
          <h2>Analytics and Map</h2>
          <p className="muted">Operational summary from applications, staff, survey tasks, certificates, and parcels.</p>
        </div>
        <div className="analytics-actions">
          <button type="button" onClick={loadAnalytics} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <a className="button-link" href={getApplicationsCsvUrl()}>
            CSV export
          </a>
        </div>
      </div>

      {errorMessage && <p className="error">{errorMessage}</p>}

      <div className="kpi-grid">
        {kpiCards.map(([label, value]) => (
          <div className="kpi-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="analytics-grid">
        <BarList title="Applications by status" rows={statusRows.map((row) => ({ label: row.status, count: row.count }))} />
        <BarList title="Applications by type" rows={typeRows.map((row) => ({ label: row.application_type, count: row.count }))} />
        <BarList title="Applications by zone" rows={zoneRows.map((row) => ({ label: row.zone_id, count: row.count }))} />
      </div>

      <section className="analytics-panel map-panel">
        <div className="map-toolbar">
          <h3>Parcel map</h3>
          <div className="map-filters">
            <label>
              Zone
              <select value={filters.zone_id} onChange={(event) => setFilters({ ...filters, zone_id: event.target.value })}>
                <option value="">all</option>
                {uniqueOptions(parcels, 'zone_id').map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Registration
              <select value={filters.registration_status} onChange={(event) => setFilters({ ...filters, registration_status: event.target.value })}>
                <option value="">all</option>
                {uniqueOptions(parcels, 'registration_status').map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dispute
              <select value={filters.dispute_state} onChange={(event) => setFilters({ ...filters, dispute_state: event.target.value })}>
                <option value="">all</option>
                {uniqueOptions(parcels, 'dispute_state').map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <AnalyticsMap parcels={filteredParcels} pendingHeatmap={filteredPendingHeatmap} />
        <p className="muted">{filteredParcels.features.length} parcels shown, {filteredPendingHeatmap.features.length} pending parcels highlighted.</p>
      </section>

      <div className="analytics-grid">
        <section className="analytics-panel">
          <h3>Processing time</h3>
          {processingRows.length === 0 ? (
            <p className="muted">No completed applications with dates</p>
          ) : (
            <table>
              <thead>
                <tr><th>Type</th><th>Avg days</th><th>Count</th></tr>
              </thead>
              <tbody>
                {processingRows.map((row) => (
                  <tr key={row.application_type}><td>{row.application_type}</td><td>{row.average_processing_days}</td><td>{row.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="analytics-panel">
          <h3>Surveyors</h3>
          {surveyors.length === 0 ? (
            <p className="muted">No surveyor records</p>
          ) : (
            <table>
              <thead>
                <tr><th>Surveyor</th><th>Active</th><th>Done</th><th>Total</th></tr>
              </thead>
              <tbody>
                {surveyors.map((surveyor) => (
                  <tr key={surveyor.staff_id}><td>{surveyor.staff_code ?? surveyor.name ?? surveyor.staff_id}</td><td>{surveyor.active_tasks}</td><td>{surveyor.completed_tasks}</td><td>{surveyor.total_tasks}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="analytics-panel">
          <h3>Registrars</h3>
          {registrars.length === 0 ? (
            <p className="muted">No registrar workload records</p>
          ) : (
            <table>
              <thead>
                <tr><th>Registrar ID</th><th>Workload</th></tr>
              </thead>
              <tbody>
                {registrars.map((registrar) => (
                  <tr key={registrar.registrar_id}><td>{registrar.registrar_id}</td><td>{registrar.workload_count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </section>
  );
}

export default AnalyticsPage;
