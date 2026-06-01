import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ForgeOS — Run AI agents with spending limits you control'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(249,115,22,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Center glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 300,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(249,115,22,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo mark */}
        <svg
          viewBox="0 0 40 40"
          width={120}
          height={120}
          style={{ marginBottom: 32 }}
        >
          <defs>
            <linearGradient id="og-fg" x1="0.5" y1="1" x2="0.5" y2="0">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="60%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="40" height="40" rx="9" fill="#18181b" />
          <rect
            x="0.5"
            y="0.5"
            width="39"
            height="39"
            rx="8.75"
            stroke="#f97316"
            strokeWidth="1"
            strokeOpacity="0.5"
          />
          <rect x="11" y="10" width="4.5" height="20" rx="2.25" fill="url(#og-fg)" />
          <rect x="11" y="10" width="14.5" height="4.5" rx="2.25" fill="url(#og-fg)" />
          <rect x="11" y="18.75" width="10.5" height="3.75" rx="1.875" fill="url(#og-fg)" />
          <circle cx="28" cy="12.25" r="2.75" fill="#fb923c" />
        </svg>

        {/* Wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#fafafa',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            Forge
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#f97316',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            OS
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: 26,
            color: '#a1a1aa',
            fontWeight: 400,
            letterSpacing: '0.01em',
            margin: 0,
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.4,
          }}
        >
          Run AI agents with spending limits and permissions you control
        </p>

        {/* Bottom badges */}
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {['Smart Accounts', 'Venice AI', 'x402 Payments', 'A2A Delegation'].map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#71717a',
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                padding: '4px 10px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
