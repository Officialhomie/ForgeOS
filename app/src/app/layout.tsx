import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/providers/Providers'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'ForgeOS',
    template: '%s | ForgeOS',
  },
  description:
    'Run AI agents with spending limits and permissions you control. Powered by Smart Accounts, Venice AI, and x402 payments.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://forgeagent.vercel.app',
  ),
  openGraph: {
    title: 'ForgeOS',
    description: 'Run AI agents with spending limits and permissions you control.',
    siteName: 'ForgeOS',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ForgeOS',
    description: 'Run AI agents with spending limits and permissions you control.',
  },
  // File-based icons: app/icon.svg, app/apple-icon.tsx, app/favicon.ico
  keywords: [
    'AI agents',
    'Smart Accounts',
    'ERC-4337',
    'Venice AI',
    'x402',
    'delegation',
    'permissions',
    'DeFi automation',
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
