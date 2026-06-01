import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#18181b',
          borderRadius: 40,
        }}
      >
        {/* F mark scaled to fill the apple icon */}
        <svg viewBox="0 0 40 40" width={130} height={130}>
          <rect x="11" y="10" width="4.5" height="20" rx="2.25" fill="#f97316" />
          <rect x="11" y="10" width="14.5" height="4.5" rx="2.25" fill="#f97316" />
          <rect x="11" y="18.75" width="10.5" height="3.75" rx="1.875" fill="#f97316" />
          <circle cx="28" cy="12.25" r="2.75" fill="#fb923c" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
