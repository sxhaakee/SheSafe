import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';

export default function AlertDashboard() {
  const router = useRouter();
  const { alert_id } = router.query;

  const [alertData, setAlertData] = useState(null);
  const [locationPings, setLocationPings] = useState([]);
  const [latestLocation, setLatestLocation] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Subscribe to alert document
  useEffect(() => {
    if (!alert_id) return;

    const unsubAlert = onSnapshot(
      doc(db, 'alerts', alert_id),
      (snapshot) => {
        if (snapshot.exists()) {
          setAlertData({ id: snapshot.id, ...snapshot.data() });
          setLoading(false);
        } else {
          setError('Alert not found or link has expired.');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Alert subscription error:', err);
        setError('Failed to load alert data.');
        setLoading(false);
      }
    );

    return () => unsubAlert();
  }, [alert_id]);

  // Subscribe to location pings (real-time)
  useEffect(() => {
    if (!alert_id) return;

    const pingsQuery = query(
      collection(db, 'alerts', alert_id, 'pings'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubPings = onSnapshot(pingsQuery, (snapshot) => {
      const pings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLocationPings(pings);

      if (pings.length > 0) {
        setLatestLocation({ lat: pings[0].lat, lng: pings[0].lng });
        setLastUpdate(new Date(pings[0].timestamp));
      }
    });

    return () => unsubPings();
  }, [alert_id]);

  // Format time ago
  const timeAgo = useCallback((date) => {
    if (!date) return 'Unknown';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }, []);

  // Refresh time display
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Google Maps URL for static display (no API key needed)
  const getMapUrl = useCallback(() => {
    if (!latestLocation) return null;
    const { lat, lng } = latestLocation;
    return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  }, [latestLocation]);

  // --- RENDER ---
  if (loading) {
    return (
      <>
        <Head>
          <title>Loading — SheSafe Dashboard</title>
        </Head>
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p style={{ color: '#A0A0A0' }}>Loading alert data...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Error — SheSafe Dashboard</title>
        </Head>
        <div className="error-screen">
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2>Alert Not Found</h2>
          <p style={{ color: '#A0A0A0', maxWidth: '400px', textAlign: 'center' }}>
            {error}
          </p>
        </div>
      </>
    );
  }

  const riskColor = alertData?.risk_level === 'emergency' ? '#C0392B'
    : alertData?.risk_level === 'alert' ? '#E67E22'
    : alertData?.risk_level === 'watchful' ? '#F1C40F'
    : '#27AE60';

  const alertTime = alertData?.timestamp
    ? new Date(alertData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : 'Unknown';

  return (
    <>
      <Head>
        <title>🚨 EMERGENCY — SheSafe Dashboard</title>
        <meta name="description" content={`SheSafe emergency alert for ${alertData?.user_name}`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="dashboard-container">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-logo">
            <span className="shield-icon">🛡️</span>
            <h1>SheSafe</h1>
          </div>
          <span className="header-badge" style={{ color: riskColor }}>
            🚨 {alertData?.risk_level?.toUpperCase() || 'ALERT'} — LIVE
          </span>
        </header>

        {/* Alert Info Bar */}
        <div className="alert-info-bar">
          <div className="info-item">
            <span className="info-label">Person</span>
            <span className="info-value">{alertData?.user_name || 'Unknown'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Phone</span>
            <span className="info-value">{alertData?.user_phone || 'N/A'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Alert Time</span>
            <span className="info-value">{alertTime}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Risk Score</span>
            <span className="info-value danger">
              {alertData?.risk_score || '—'}/100
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Last GPS Update</span>
            <span className="info-value warning">
              {lastUpdate ? timeAgo(lastUpdate) : 'Waiting...'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Coordinates</span>
            <span className="info-value" style={{ fontSize: '13px' }}>
              {latestLocation
                ? `${latestLocation.lat.toFixed(4)}°N, ${latestLocation.lng.toFixed(4)}°E`
                : alertData?.lat && alertData?.lng
                  ? `${alertData.lat.toFixed(4)}°N, ${alertData.lng.toFixed(4)}°E`
                  : 'Acquiring...'}
            </span>
          </div>
        </div>

        {/* Map Section */}
        <div className="map-section">
          <div className="map-overlay">
            <div className="live-dot" />
            <div>
              <div className="live-text">Live Tracking Active</div>
              <div className="last-update">
                Updates every 30 seconds • {locationPings.length} pings received
              </div>
            </div>
          </div>

          {(latestLocation || (alertData?.lat && alertData?.lng)) ? (
            <iframe
              className="map-container"
              src={`https://maps.google.com/maps?q=${
                latestLocation?.lat || alertData?.lat
              },${
                latestLocation?.lng || alertData?.lng
              }&z=16&output=embed`}
              style={{ border: 'none' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Live location map"
            />
          ) : (
            <div className="map-container" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#1A1A1A',
            }}>
              <div style={{ textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📍</div>
                <p>Waiting for GPS signal...</p>
              </div>
            </div>
          )}
        </div>

        {/* Risk Timeline */}
        {locationPings.length > 0 && (
          <div className="risk-timeline">
            <h3>📊 Location Ping History</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '8px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}>
              {locationPings.slice(0, 20).map((ping, i) => (
                <div key={ping.id} style={{
                  background: '#1A1A1A',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  border: i === 0 ? '1px solid rgba(192,57,43,0.4)' : '1px solid #2A2A2A',
                }}>
                  <span style={{ color: '#A0A0A0' }}>
                    {ping.lat?.toFixed(4)}°, {ping.lng?.toFixed(4)}°
                  </span>
                  <span style={{ color: i === 0 ? '#C0392B' : '#666', fontWeight: i === 0 ? 700 : 400 }}>
                    {ping.timestamp
                      ? new Date(ping.timestamp).toLocaleTimeString('en-IN')
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bottom-panel">
          <a
            href={`tel:${alertData?.user_phone || ''}`}
            className="action-btn btn-call"
          >
            📞 Call {alertData?.user_name?.split(' ')[0] || 'Her'}
          </a>

          <a
            href={`https://maps.google.com/?q=${
              latestLocation?.lat || alertData?.lat || 0
            },${
              latestLocation?.lng || alertData?.lng || 0
            }`}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn btn-police"
          >
            🗺️ Open in Google Maps
          </a>

          <a href="tel:112" className="action-btn btn-police">
            🚔 Call Police (112)
          </a>

          {alertData?.evidence_url && (
            <a
              href={alertData.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-btn btn-evidence"
            >
              🎙️ Listen to Evidence Audio
            </a>
          )}
        </div>
      </div>
    </>
  );
}
