import { ImageResponse } from 'next/og'
import { ForgeMarkOg } from '@/lib/brand/forge-mark-og'
import { FORGE_BRAND } from '@/lib/brand/tokens'

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
          backgroundColor: FORGE_BRAND.background,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '0 80px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(249,115,22,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.05) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <ForgeMarkOg width={56} height={56} gradientId="tw-fg" />
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: '#71717a',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              ForgeOS
            </span>
          </div>
          <div style={{ display: 'flex', marginBottom: 20 }}>
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: FORGE_BRAND.text,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              AI agents that work for you.
            </span>
          </div>
          <p
            style={{
              fontSize: 22,
              color: FORGE_BRAND.textMuted,
              margin: 0,
              maxWidth: 520,
              lineHeight: 1.5,
            }}
          >
            Spending limits, granular permissions, zero-knowledge control.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
            {['ERC-4337', 'Venice AI', 'x402'].map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: FORGE_BRAND.orange,
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
          <ForgeMarkOg width={280} height={280} gradientId="tw-bg" showContainer={false} />
        </div>
      </div>
    ),
    { ...size },
  )
}
