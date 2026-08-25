'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1226', color: '#fff', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <p style={{ color: '#a5b4fc', fontSize: 14, margin: '0 0 8px' }}>GKK ERP</p>
        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Something went wrong</h1>
        <p style={{ color: '#c7d2fe', fontSize: 14, lineHeight: 1.5 }}>{error.message || 'The page failed to render.'}</p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: 20, background: '#6366f1', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
