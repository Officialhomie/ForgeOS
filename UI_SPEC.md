# UI Specification — Design System & Component Spec
**Product:** ForgeOS
**Version:** 1.1
**Date:** May 27, 2026
**Related:** [PRD.md](./PRD.md) | [APP_FLOW.md](./APP_FLOW.md) | [DATA_MODEL.md](./DATA_MODEL.md)

---

## Design Principles

- **Dark-first, single theme.** No light mode. `color-scheme: dark` enforced globally.
- **Monospace for addresses.** Every on-chain identifier uses `font-mono`.
- **Orange brand.** `forge-orange` (#f97316) is the primary action color. Overuse degrades impact.
- **Status colors are immutable.** Never use green for running or red for active. These rules are enforced across every component.
- **Kill Switch always visible.** The red Kill Switch button in TopBar is never hidden, disabled, or moved.
- **No emojis in UI.** Lucide icons only.

---

## Design Tokens

All tokens defined in `app/src/app/globals.css` under `@theme`.

### Background & Surface

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| `forge-bg` | `--color-forge-bg` | `#09090b` | Page background, deepest layer |
| `forge-surface` | `--color-forge-surface` | `#18181b` | Cards, sidebar, panels |
| `forge-elevated` | `--color-forge-elevated` | `#27272a` | Hover states, active nav items |
| `forge-border` | `--color-forge-border` | `#3f3f46` | Card borders, section dividers |
| `forge-border-subtle` | `--color-forge-border-subtle` | `#27272a` | Inner dividers, list separators |

### Brand

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| `forge-orange` | `--color-forge-orange` | `#f97316` | Primary buttons, brand accents, logo |
| `forge-orange-bright` | `--color-forge-orange-bright` | `#fb923c` | Hover state for orange elements |
| `forge-orange-dim` | `--color-forge-orange-dim` | `#ea580c` | Active/pressed state for orange |

### Text

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| `forge-text` | `--color-forge-text` | `#fafafa` | Primary body text, headings |
| `forge-text-muted` | `--color-forge-text-muted` | `#a1a1aa` | Secondary labels, metadata |
| `forge-text-subtle` | `--color-forge-text-subtle` | `#71717a` | Timestamps, hints, disabled |
| `forge-text-inverse` | `--color-forge-text-inverse` | `#09090b` | Text on light backgrounds |
| `forge-mono` | `--color-forge-mono` | `#d4d4d8` | Monospace text (addresses, hashes) |

### Status Colors (STRICT — never reassign)

| Token | CSS Variable | Hex | Meaning | Agent Status |
|-------|-------------|-----|---------|-------------|
| `forge-success` | `--color-forge-success` | `#22c55e` | Success, confirmed, active | `active` |
| `forge-success-dim` | `--color-forge-success-dim` | `#16a34a` | Darker success variant | — |
| `forge-warning` | `--color-forge-warning` | `#eab308` | Paused, pending, caution | `paused` |
| `forge-danger` | `--color-forge-danger` | `#ef4444` | Error, revoked, kill switch | `failed`, `revoked` |
| `forge-danger-dim` | `--color-forge-danger-dim` | `#dc2626` | Darker danger variant | — |
| `forge-info` | `--color-forge-info` | `#3b82f6` | Informational, links | — |
| `forge-orange` | `--color-forge-orange` | `#f97316` | Running, in-progress, brand | `running` |

**Rule:** `active = green`, `running = orange (animated pulse)`, `paused = yellow`, `error/revoked = red`. This mapping is enforced in `StatusBadge` and must never be changed.

---

## Typography

### Fonts

| Font | Variable | Usage |
|------|----------|-------|
| Geist Sans | `--font-sans` | All UI text — headings, body, labels |
| Geist Mono | `--font-mono` | All on-chain data — addresses, hashes, amounts, JSON |

Fonts loaded via Next.js `next/font/google` in `app/layout.tsx`.

### Type Scale

| Class | Size | Weight | Usage |
|-------|------|--------|-------|
| `text-3xl font-bold` | 30px | 700 | Hero text, landing page |
| `text-2xl font-bold` | 24px | 700 | Page titles (h1) |
| `text-xl font-semibold` | 20px | 600 | Section headers (h2) |
| `text-base font-semibold` | 16px | 600 | Card titles, subsection headers |
| `text-sm` | 14px | 400 | Body text, form labels |
| `text-xs` | 12px | 400 | Metadata, timestamps, tooltips |
| `text-xs font-mono` | 12px | 400 | Address display, hash display |

### Address Display Rule

**Every on-chain address or hash MUST be:**
1. Truncated to `0xABCD...1234` format (first 6 + last 4 chars)
2. Rendered in `font-mono text-forge-mono`
3. Accompanied by a `CopyButton` that copies the full address
4. Never shown in full except in detail/debug views

---

## Component Specifications

### `Button`

**File:** `components/ui/Button.tsx`
**Library:** `@base-ui/react/button` with `class-variance-authority`

| Variant | Description | Primary Use |
|---------|-------------|-------------|
| `default` | Orange background, dark text | Primary actions (Activate, Deploy, Execute) |
| `outline` | Bordered, transparent bg | Secondary actions |
| `secondary` | Zinc background | Alternative secondary actions |
| `ghost` | No bg, hover shows muted | Tertiary actions (Disconnect) |
| `destructive` | Red tinted | Kill Switch, revoke actions |
| `link` | Underline on hover | Inline links |

| Size | Height | Use |
|------|--------|-----|
| `xs` | 24px | Compact tables, badges |
| `sm` | 28px | Card actions |
| `default` | 32px | Standard form buttons |
| `lg` | 36px | Prominent CTAs |
| `icon` | 32x32 | Icon-only actions |

---

### `StatusBadge`

**File:** `components/ui/StatusBadge.tsx`

```tsx
<StatusBadge variant="active" />   // green — agent is active
<StatusBadge variant="running" />  // orange + pulse — agent is executing
<StatusBadge variant="paused" />   // yellow — agent is paused
<StatusBadge variant="error" />    // red — agent has failed
```

- Rounded pill: `rounded-full border px-2.5 py-0.5 text-xs font-medium`
- `running` variant includes `animate-pulse` class
- Custom `label` prop overrides default text

---

### `AddressDisplay`

**File:** `components/ui/AddressDisplay.tsx`

```tsx
<AddressDisplay address="0x1234...abcd" />
// Renders: 0x1234...abcd [copy icon]
```

- Always shows: first 6 chars + `...` + last 4 chars
- `font-mono text-forge-mono text-xs`
- Copy button: `CopyButton` with "Copied!" feedback tooltip

---

### `TokenAmount`

**File:** `components/ui/TokenAmount.tsx`

```tsx
<TokenAmount amount={1_500_000n} />
// Renders: 1.50 USDC
```

- USDC has 6 decimal places (`amount / 1_000_000n`)
- Always shows exactly 2 decimal places
- `font-mono tabular-nums`
- Positive amounts: `text-forge-text`
- Large amounts (>100 USDC): `text-forge-success`

---

### `Card`

**File:** `components/ui/card.tsx`

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

- Background: `bg-forge-surface`
- Border: `border border-forge-border`
- Radius: `rounded-xl`
- Padding: `p-5` (20px)

---

### `LoadingSkeleton`

**File:** `components/ui/LoadingSkeleton.tsx`

```tsx
<LoadingSkeleton className="h-9 w-32" />
```

- Background: `bg-forge-elevated animate-pulse rounded`
- Use for: balances, agent lists, delegation counts during async load
- Width/height passed via `className`

---

### `EmptyState`

**File:** `components/ui/EmptyState.tsx`

```tsx
<EmptyState
  title="No agents"
  description="Activate ForgeOS to install your agent fleet."
  action={<Button>Activate</Button>}
/>
```

- Centered in container
- Icon slot (optional Lucide icon)
- `text-forge-text-muted` description
- Optional action slot for primary CTA

---

### `NetworkIndicator`

**File:** `components/ui/NetworkIndicator.tsx`

- Shows current chain name (e.g., "Sepolia")
- Indicator dot: green if on correct chain, red if wrong chain
- Always in TopBar, always visible

---

## Dashboard Shell

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (h-14)                                           │
│  [NetworkIndicator] [⌘K hint]    [Kill Switch] [Wallet] │
├────────────────┬────────────────────────────────────────┤
│ Sidebar (w-60) │ Main Content Area                      │
│                │                                        │
│ ForgeOS        │  <page content>                        │
│ Agent kernel   │                                        │
│                │                                        │
│ [nav items]    │                                        │
│                │                                        │
│ OS Status      │                                        │
└────────────────┴────────────────────────────────────────┘
```

### Sidebar Nav Items

Currently rendered from `NAV_ITEMS` in `lib/constants.ts`:

| Icon | Label | Path |
|------|-------|------|
| `LayoutDashboard` | Overview | `/dashboard` |
| `Bot` | Agents | `/dashboard/agents` |
| `GitBranch` | Delegations | `/dashboard/delegations` |
| `Wallet` | Treasury | `/dashboard/treasury` |
| `Repeat` | Subscriptions | `/dashboard/subscriptions` |
| `Hammer` | Builder | `/dashboard/builder` — NEW |
| `Store` | Marketplace | `/marketplace` — NEW |

**Phase 5/6 additions:** Add `Hammer` (Builder) and `Store` (Marketplace) to `NAV_ITEMS` in `constants.ts` and add `Hammer` and `Store` to `ICONS` map in `Sidebar.tsx`.

### TopBar Elements

Left side:
- `NetworkIndicator` — chain name + dot
- `⌘K` pill button — opens CommandBarModal

Right side:
- `Kill Switch` — `Button variant="destructive"` — ALWAYS VISIBLE — opens KillSwitchModal
- `AddressDisplay` (if connected) or `Connect Wallet` button
- `Disconnect` ghost button (if connected)

---

## Animations

All animations use Tailwind built-ins + `tw-animate-css`.

| Animation | Class | Used For |
|-----------|-------|---------|
| Pulse | `animate-pulse` | Running agent badge, loading skeletons |
| Spin | `animate-spin` | Loading spinners (TX pending states) |
| Fade in | `animate-in fade-in` | Modal enter transitions |
| Slide up | `animate-in slide-in-from-bottom-4` | Modal enter from bottom |
| Bounce (subtle) | `animate-bounce` | Confirmation success indicators |

**Modal Transitions (CommandBarModal, KillSwitchModal):**
```css
/* Enter */
animate-in fade-in duration-200

/* Exit */
animate-out fade-out duration-150
```

---

## Page-Level Layout Rules

### Content Width
- Max width: `max-w-7xl mx-auto`
- Padding: `px-6` on sides
- Section spacing: `space-y-6`

### Grid System (Dashboard Overview)
```tsx
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-4">  {/* stat card */}
  <div className="col-span-12 md:col-span-4">
  <div className="col-span-12 md:col-span-4">
  <div className="col-span-12">               {/* full-width section */}
</div>
```

### Section Containers
```tsx
<section className="rounded-xl border border-forge-border bg-forge-surface p-5">
  <h2 className="text-base font-semibold">Section Title</h2>
  {/* content */}
</section>
```

---

## Form Design Rules

### Input Fields
```tsx
<input
  className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text placeholder:text-forge-text-subtle focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
/>
```

### Select Fields
- Same styling as inputs
- Chevron icon via `lucide-react`

### Form Labels
- `text-sm font-medium text-forge-text-muted`
- Always above the input

### Validation States
- Error: red border `border-forge-danger`, helper text `text-forge-danger text-xs mt-1`
- Valid: no extra styling (default border)

---

## Specific Component Patterns

### Delegation Card
```
┌─────────────────────────────────────────┐
│ [GitBranch icon] OSKernel → DeFiAgent   │
│ [StatusBadge: Active]                   │
│                                         │
│ Authority: 0xROOT                       │
│ Issued: 2 days ago                      │
│                                         │
│ Caveats:                                │
│   • Max 500 USDC per call               │
│   • Only swap(), rebalance()            │
│   • Expires Dec 2026                    │
│                                         │
│         [Revoke Delegation ▼]           │
└─────────────────────────────────────────┘
```

### Treasury Stat Card
```
┌─────────────────┐
│ Treasury balance│
│ 432.50 USDC     │  ← text-3xl font-bold font-mono
│                 │
│ ████████░░ 86%  │  ← Progress bar (orange fill)
│ of $500 cap     │
└─────────────────┘
```

### Agent Row (Dashboard Overview)
```
DeFi Rebalancer     [StatusBadge: Active]
3 minutes ago
─────────────────────────────────────────
NFT Lifeguard       [StatusBadge: Paused]
Never run
```

### Command Bar (Modal Overlay)
```
┌─────────────────────────────────────────────┐
│                                             │
│  [search icon] What should ForgeOS do?      │
│                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                             │
│  Recent:                                    │
│  > Rebalance portfolio to 50/30/20          │
│  > Pay monthly subscription to Lens         │
│                                             │
└─────────────────────────────────────────────┘
```

**States:** `idle → reasoning (spinner) → planning (plan preview) → executing (progress) → confirmed (green check) / failed (red X)`

---

## Responsive Behavior

ForgeOS is a desktop-first dApp. Breakpoints:

| Breakpoint | Class | Behavior |
|------------|-------|---------|
| `sm` (640px+) | — | ⌘K hint appears in TopBar |
| `md` (768px+) | `md:col-span-4` | 3-column stat grid |
| `lg` (1024px+) | — | Full sidebar + content |

Mobile (< 640px): Basic usable but not optimized. Sidebar collapses, content stacks.

---

## Accessibility Rules

- All interactive elements: `focus-visible:ring-2 focus-visible:ring-orange-500/50`
- Color is never the only indicator — always paired with text or icon
- Modal overlays: `role="dialog" aria-modal="true"`
- Kill Switch: `aria-label="Emergency kill switch — revoke all delegations"`
- Loading states: `aria-busy="true"` on containers
- Address display: `aria-label="Wallet address: 0x...{full}"` (even though truncated visually)
