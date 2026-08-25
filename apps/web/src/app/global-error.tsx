'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1226', color: '#fff', padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>CompanyOS failed to load</h1>
            <p style={{ color: '#c7d2fe', fontSize: 14, lineHeight: 1.5 }}>{error.message || 'A root-level error stopped the app.'}</p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 20, background: '#6366f1', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
