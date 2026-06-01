import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ForgeOS — Run AI agents with spending limits you control'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#09090b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '0 80px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(249,115,22,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.05) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Left: text content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            {/* Mini mark */}
            <svg viewBox="0 0 40 40" width={56} height={56}>
              <rect x="0" y="0" width="40" height="40" rx="9" fill="#18181b" />
              <rect x="0.5" y="0.5" width="39" height="39" rx="8.75" stroke="#f97316" strokeWidth="1" strokeOpacity="0.5" />
              <rect x="11" y="10" width="4.5" height="20" rx="2.25" fill="#f97316" />
              <rect x="11" y="10" width="14.5" height="4.5" rx="2.25" fill="#f97316" />
              <rect x="11" y="18.75" width="10.5" height="3.75" rx="1.875" fill="#f97316" />
              <circle cx="28" cy="12.25" r="2.75" fill="#fb923c" />
            </svg>
            <span style={{ fontSize: 22, fontWeight: 600, color: '#71717a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ForgeOS
            </span>
          </div>

          <div style={{ display: 'flex', marginBottom: 20 }}>
            <span style={{ fontSize: 56, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              AI agents that work for you.
            </span>
          </div>

          <p style={{ fontSize: 22, color: '#a1a1aa', margin: 0, maxWidth: 520, lineHeight: 1.5 }}>
            Spending limits, granular permissions, zero-knowledge control.
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
            {['ERC-4337', 'Venice AI', 'x402'].map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#f97316',
                  backgroundColor: 'rgba(249,115,22,0.1)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  borderRadius: 6,
                  padding: '5px 12px',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Right: large mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            opacity: 0.15,
            marginLeft: 40,
          }}
        >
          <svg viewBox="0 0 40 40" width={280} height={280}>
            <rect x="11" y="10" width="4.5" height="20" rx="2.25" fill="#f97316" />
            <rect x="11" y="10" width="14.5" height="4.5" rx="2.25" fill="#f97316" />
            <rect x="11" y="18.75" width="10.5" height="3.75" rx="1.875" fill="#f97316" />
            <circle cx="28" cy="12.25" r="2.75" fill="#fb923c" />
          </svg>
        </div>
      </div>
    ),
    { ...size },
  )
}
