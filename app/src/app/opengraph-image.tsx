import { ImageResponse } from 'next/og'
import { ForgeMarkOg } from '@/lib/brand/forge-mark-og'
import { FORGE_BRAND } from '@/lib/brand/tokens'

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
          backgroundColor: FORGE_BRAND.background,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(249,115,22,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
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
        <div style={{ marginBottom: 32 }}>
          <ForgeMarkOg width={120} height={120} gradientId="og-fg" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 24 }}>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: FORGE_BRAND.text,
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
              color: FORGE_BRAND.orange,
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            OS
          </span>
        </div>
        <p
          style={{
            fontSize: 26,
            color: FORGE_BRAND.textMuted,
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
                backgroundColor: FORGE_BRAND.surface,
                border: `1px solid ${FORGE_BRAND.border}`,
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
    { ...size },
  )
}
