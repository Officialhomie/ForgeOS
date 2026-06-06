import { ImageResponse } from 'next/og'
import { ForgeMarkOg } from '@/lib/brand/forge-mark-og'
import { FORGE_BRAND } from '@/lib/brand/tokens'

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
          backgroundColor: FORGE_BRAND.surface,
          borderRadius: 40,
        }}
      >
        <ForgeMarkOg width={130} height={130} gradientId="apple-fg" showContainer={false} />
      </div>
    ),
    { ...size },
  )
}
