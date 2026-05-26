import { Exo_2, Orbitron } from 'next/font/google'

const display = Orbitron({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
})

const bodyAlt = Exo_2({
  subsets: ['latin'],
  variable: '--font-body-alt',
  weight: ['400', '500'],
})

export default function ActivateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${display.variable} ${bodyAlt.variable} font-[family-name:var(--font-body-alt)]`}>
      {children}
    </div>
  )
}
