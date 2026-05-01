import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>SheSafe — Emergency Dashboard</title>
        <meta name="description" content="SheSafe trusted contact emergency dashboard" />
      </Head>
      <div className="loading-screen">
        <div style={{ fontSize: '64px' }}>🛡️</div>
        <h2 style={{ fontSize: '28px', fontWeight: 800 }}>SheSafe</h2>
        <p style={{ color: '#A0A0A0' }}>
          Access the dashboard via the alert link sent to your phone.
        </p>
        <p style={{ color: '#666', fontSize: '13px' }}>
          Format: /dashboard/[alert_id]
        </p>
      </div>
    </>
  );
}
