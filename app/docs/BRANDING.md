# ForgeOS brand assets

## Identity

**Forge Mark** — squircle container (`#18181b`), bold **F** letterform (orange gradient bottom → top), **spark** dot at the top crossbar tip (creation / ignition).

| Token | Value | Use |
|-------|--------|-----|
| Brand orange | `#f97316` | Primary accent, wordmark “OS” |
| Spark bright | `#fb923c` | Spark dot, gradient top |
| Forge dim | `#ea580c` | Gradient bottom |
| Surface | `#18181b` | Mark container |
| Background | `#09090b` | OG / landing |
| Wordmark | Geist Sans 700 | “Forge” white + “OS” orange |

Code tokens: `src/lib/brand/tokens.ts`

## Workflow

Hand-crafted **SVG** + **Next.js `ImageResponse`** (`next/og`). No AI raster generators; no extra CLI tools. Assets ship in the app build.

## Asset map

| Asset | Path | Purpose |
|-------|------|---------|
| `ForgeMark` | `src/components/ui/ForgeMark.tsx` | Inline React SVG (UI) |
| `ForgeLogo` | `src/components/ui/ForgeLogo.tsx` | Mark + wordmark (`markSize`, `markOnly`, `variant`) |
| `ForgeMarkOg` | `src/lib/brand/forge-mark-og.tsx` | Shared mark for OG/Twitter/Apple PNG generation |
| Mark (static) | `public/forge-mark.svg` | Downloads, README, external use |
| Logo (static) | `public/forge-logo.svg` | Full wordmark SVG |
| Bare mark | `public/forge-mark-bare.svg` | F + spark without container |
| Social banner | `public/social-banner.svg` | 1500×500 GitHub / demo header |
| Favicon | `src/app/icon.svg` | Browser tab (App Router file convention) |
| Legacy ICO | `src/app/favicon.ico` | Older browsers |
| Open Graph | `src/app/opengraph-image.tsx` | 1200×630 PNG (auto) |
| Twitter | `src/app/twitter-image.tsx` | 1200×630 card (auto) |
| Apple touch | `src/app/apple-icon.tsx` | 180×180 PNG (auto) |

## UI integration

| Surface | Component |
|---------|-----------|
| `layout.tsx` | `metadata` — title template, OG/Twitter, `metadataBase` |
| Landing `page.tsx` | `ForgeMark` + grid/glow hero |
| `Sidebar.tsx` | `ForgeLogo` |
| `DashboardShell.tsx` | `ForgeLogo` (mobile) |
| `ActivationWizard.tsx` | `ForgeLogo` |
| `ZustandHydration.tsx` | Pulsing `ForgeMark` loading state |

## Production URLs

Production URL: `https://forgeagent.vercel.app`. Set `NEXT_PUBLIC_APP_URL` to that value so `metadataBase` resolves OG/Twitter image URLs correctly.

Generated routes (after deploy):

- `/opengraph-image`
- `/twitter-image`
- `/apple-icon`
- `/icon` (from `icon.svg`)
