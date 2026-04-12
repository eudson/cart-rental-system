# Golf Cart Rental — Frontend Design Guide

**Version:** 1.0
**Applies to:** `apps/web`
**Stack:** Vite + React + TypeScript + shadcn/ui + Tailwind CSS
**Design language:** Minimalist, Apple-inspired — clean, calm, operationally efficient

---

## 1. Design Principles

1. **Clarity over decoration** — every element earns its place. No gradients, shadows, or color for aesthetics alone.
2. **Density without clutter** — staff operate this app under time pressure. Information must be scannable at a glance.
3. **Calm defaults** — neutral palette by default. Color is reserved for status and action, never decoration.
4. **Consistency over cleverness** — use the same pattern for the same problem everywhere. No one-off solutions.
5. **Fast interactions** — no full-page reloads for actions. Use optimistic updates where safe. Skeletons over spinners.

---

## 2. Token System (CSS Variables)

All tokens are defined in `apps/web/src/index.css` on `:root`. **Never hardcode color values in components** — always reference tokens via Tailwind utility classes that map to these variables.

### Color Tokens

```css
:root {
  /* Backgrounds */
  --color-background:        #ffffff;
  --color-background-subtle: #f9f9f9;  /* page bg, sidebar bg */
  --color-background-muted:  #f4f4f5;  /* input bg, disabled states */

  /* Foregrounds */
  --color-foreground:        #09090b;  /* primary text */
  --color-foreground-muted:  #71717a;  /* secondary text, labels */
  --color-foreground-subtle: #a1a1aa;  /* placeholder, disabled text */

  /* Borders */
  --color-border:            #e4e4e7;
  --color-border-strong:     #d4d4d8;

  /* Primary (org-overridable in Phase 2) */
  --color-primary:           #18181b;  /* default: near-black */
  --color-primary-foreground:#ffffff;

  /* Secondary */
  --color-secondary:         #f4f4f5;
  --color-secondary-foreground: #18181b;

  /* Accent (interactive focus, links) */
  --color-accent:            #3f3f46;
  --color-accent-foreground: #ffffff;

  /* Destructive */
  --color-destructive:       #ef4444;
  --color-destructive-foreground: #ffffff;

  /* Status — Cart */
  --color-status-available:  #22c55e;  /* green */
  --color-status-rented:     #3b82f6;  /* blue */
  --color-status-reserved:   #f59e0b;  /* amber */
  --color-status-retired:    #a1a1aa;  /* muted gray */

  /* Status — Rental */
  --color-status-pending:    #f59e0b;  /* amber */
  --color-status-active:     #3b82f6;  /* blue */
  --color-status-completed:  #22c55e;  /* green */
  --color-status-cancelled:  #a1a1aa;  /* muted gray */

  /* Status — Payment */
  --color-status-unpaid:     #ef4444;  /* red */
  --color-status-partial:    #f59e0b;  /* amber */
  --color-status-paid:       #22c55e;  /* green */
  --color-status-refunded:   #a1a1aa;  /* muted gray */

  /* Radius */
  --radius:                  0.5rem;   /* 8px — base radius */
  --radius-sm:               0.375rem; /* 6px */
  --radius-lg:               0.75rem;  /* 12px */

  /* Shadows — used sparingly */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --shadow:    0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
}
```

### Runtime Theming (Phase 2 note)

The token set above is designed so that per-org theming only needs to override:
- `--color-primary` + `--color-primary-foreground`
- `--color-secondary` + `--color-secondary-foreground`
- `--color-accent` + `--color-accent-foreground`

On login, inject the org's theme config as a `<style>` tag on `:root`. No component changes required.

---

## 3. Typography

**Font stack:** Inter (primary), fallback to system-ui, then SF Pro on Apple devices.

```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
```

Install Inter via `@fontsource/inter` (self-hosted, no Google Fonts dependency).

### Type Scale

| Role | Class | Size | Weight | Use |
|------|-------|------|--------|-----|
| Page heading | `text-2xl font-semibold tracking-tight` | 24px | 600 | Page `<h1>` |
| Section heading | `text-lg font-medium` | 18px | 500 | Card titles, section labels |
| Body | `text-sm` | 14px | 400 | Default body text, table cells |
| Label | `text-xs font-medium uppercase tracking-wide` | 12px | 500 | Form labels, column headers |
| Caption | `text-xs text-muted-foreground` | 12px | 400 | Timestamps, helper text |

**Rules:**
- Never use `font-bold` (700) in UI chrome — reserve for emphasis within content only
- `tracking-tight` on headings only
- `text-muted-foreground` for anything secondary — never custom gray values

---

## 4. Layout Shell

### Structure

```
┌─────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Main area    │
│  ┌─────────────────┐    │  ┌──────────┐ │
│  │  Logo slot       │    │  │ TopBar   │ │
│  │  (logo or name)  │    │  └──────────┘ │
│  ├─────────────────┤    │  ┌──────────┐ │
│  │  Nav links       │    │  │ Page     │ │
│  │  (role-aware)    │    │  │ content  │ │
│  ├─────────────────┤    │  └──────────┘ │
│  │  Org name        │    │               │
│  │  User / logout   │    │               │
│  └─────────────────┘    │               │
└─────────────────────────────────────────┘
```

### Sidebar spec

- Width: `240px` fixed, never collapsible in MVP
- Background: `--color-background-subtle`
- Border right: `1px solid var(--color-border)`
- No shadow on sidebar

**Logo slot (top of sidebar):**
- Height: `56px` — same as TopBar for visual alignment
- If org has logo: render `<img>` constrained to `h-7` max, left-aligned with `px-4`
- If no logo: render org name as `text-sm font-semibold text-foreground`
- Logo is loaded from org profile (Phase 2: from `Organization.logoUrl`; MVP: hardcoded or env var)

**Nav links:**
- Active state: `bg-background` (white lift) + `text-foreground` + left border `2px solid var(--color-primary)`
- Inactive state: `text-foreground-muted` + hover `bg-background-muted`
- Icon: 16px, left of label, same color as text
- Groups separated by `<Separator />` with group label in caption style

**Bottom of sidebar:**
- Org name: caption style, muted
- Logged-in user name + role badge
- Logout button: ghost, destructive on hover

### TopBar spec

- Height: `56px`
- Background: `--color-background`
- Border bottom: `1px solid var(--color-border)`
- Left: current page title (`text-lg font-medium`)
- Right: contextual action button (e.g. "New Rental"), user avatar/menu

### PageWrapper spec

- Padding: `px-6 py-6`
- Max width: `max-w-screen-xl mx-auto` (unconstrained on most pages — ops tools need full width)
- Page heading + subtitle as first element, then content

---

## 5. Component Conventions

### Buttons

| Variant | Use |
|---------|-----|
| `default` | Primary action (one per screen max) |
| `secondary` | Secondary action alongside a primary |
| `outline` | Tertiary, filter toggles |
| `ghost` | Icon buttons, nav items, table row actions |
| `destructive` | Delete, cancel, irreversible actions |

- Size: `default` for page actions, `sm` for table/card actions
- Never use `lg` size — too heavy for an ops tool
- Always include a loading state (`disabled + spinner`) on async actions
- Icon-only buttons must have a `title` attribute for accessibility

### Forms

- All inputs use shadcn `Input`, `Select`, `Textarea` — never raw HTML elements
- Label above input, never placeholder-as-label
- Error message below input in `text-destructive text-xs`
- Required fields: asterisk `*` in label, muted color
- Form layout: single column on mobile, two columns on desktop for wide forms
- Submit button: right-aligned, `default` variant
- Cancel/back: left of submit, `ghost` variant

### Tables

- Use shadcn `Table` primitives
- Column headers: `label` type scale (uppercase, xs, medium weight)
- Row hover: `bg-background-muted`
- Pagination below table: page size selector + prev/next
- Empty state inside table area (not a full page replacement)
- Actions column: right-aligned, ghost icon buttons, revealed on row hover

### Cards

- Background: `--color-background`
- Border: `1px solid var(--color-border)`
- Border radius: `--radius-lg`
- Shadow: `--shadow-sm` only — never `shadow-md` or higher
- Padding: `p-5` standard, `p-4` compact

### Badges (Status)

All status values map to a fixed badge color. Use the `Badge` component with a `variant` prop that maps to the token. **Never use arbitrary Tailwind colors for status.**

**Cart status:**
| Status | Color |
|--------|-------|
| `available` | Green (`--color-status-available`) |
| `rented` | Blue (`--color-status-rented`) |
| `reserved` | Amber (`--color-status-reserved`) |
| `retired` | Muted gray (`--color-status-retired`) |

**Rental status:**
| Status | Color |
|--------|-------|
| `pending` | Amber |
| `active` | Blue |
| `completed` | Green |
| `cancelled` | Muted gray |

**Payment status:**
| Status | Color |
|--------|-------|
| `unpaid` | Red (`--color-status-unpaid`) |
| `partial` | Amber |
| `paid` | Green |
| `refunded` | Muted gray |

Badge style: filled background at 15% opacity, text at full token color, no border. Example: available = `bg-green-500/15 text-green-600`.

---

## 6. States & Patterns

### Loading state

- **Always use Skeleton**, never a spinner for page or section loads
- Skeleton matches the shape of the content it replaces (table rows, card blocks)
- Inline async actions (button submit): button goes `disabled` + shows a 16px spinner inside the button only
- Never show a full-page loading overlay

### Empty state

Use consistently across all list pages and tables.

Structure:
```
[Icon — 32px, muted]
[Heading — "No rentals found"]
[Subtext — "Create a rental to get started." — caption, muted]
[CTA button — optional, only if user can create]
```

- Centered vertically and horizontally within the list/table area
- Icon from `lucide-react`, muted color
- Never use illustrations in MVP

### Error state

| Error type | Pattern |
|------------|---------|
| Field validation | Inline below input, `text-destructive text-xs` |
| Form submission failure | Toast (destructive) + keep form data intact |
| Page-level fetch failure | Inline error card with retry button — no toast |
| Optimistic update failure | Toast (destructive) + revert UI state |

### Toast notifications

- Use shadcn `Sonner` or `Toast`
- Position: bottom-right
- Success: default style (not green — too noisy for ops tools)
- Error: destructive variant
- Duration: 4 seconds default, no auto-dismiss on errors
- Max 1 toast visible at a time — queue, don't stack

### Confirmation dialogs

Use shadcn `AlertDialog` for all destructive or irreversible actions:
- Cancel rental
- Delete cart type
- Deactivate user

Never use `window.confirm()`.

---

## 7. Navigation Map (Sidebar links by role)

| Link | Icon | Roles |
|------|------|-------|
| Dashboard | `LayoutDashboard` | staff, org_admin |
| Carts | `Car` | staff, org_admin |
| Customers | `Users` | staff, org_admin |
| Rentals | `CalendarDays` | staff, org_admin |
| Payments | `CreditCard` | staff, org_admin |
| — Settings group — | | |
| Organization | `Building2` | org_admin |
| Locations | `MapPin` | org_admin |
| Cart Types | `Tag` | org_admin |
| Users | `UserCog` | org_admin |

Links invisible to the current role are not rendered — not disabled, not hidden with CSS. Remove from DOM entirely.

---

## 8. Spacing & Sizing Rules

- Base unit: `4px` (Tailwind default)
- Between page sections: `gap-6` (24px)
- Between related elements within a section: `gap-4` (16px)
- Between tightly coupled elements (label + input): `gap-1.5` (6px)
- Page top padding: `py-6`
- Table cell padding: `px-4 py-3`
- Never use arbitrary values (e.g. `mt-[13px]`) — always nearest Tailwind step

---

## 9. Do / Don't

| Do | Don't |
|----|-------|
| Use tokens for all colors | Hardcode hex values in components |
| Use Skeleton for loading | Use full-page spinners |
| Use `AlertDialog` for destructive actions | Use `window.confirm()` |
| Keep one primary action per screen | Stack multiple `default` buttons |
| Use `lucide-react` icons consistently | Mix icon libraries |
| Use `text-muted-foreground` for secondary text | Invent custom gray shades |
| Render empty states inside list areas | Replace entire page with empty state |
| Use `toast` for action feedback | Use `alert()` or inline banners for transient feedback |
| Hide nav links the role cannot access | Disable or gray out inaccessible nav items |

---

## 10. Dashboard Pattern

The dashboard uses a **tabbed layout** with four tabs: `Overview`, `Inventory`, `Daily Rentals`, `Leases`. Tabs are rendered using shadcn `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`.

### Tab conventions
- Tab bar sits directly below the `PageWrapper` heading, above all content
- Active tab: `text-foreground` + bottom border `2px solid var(--color-primary)`
- Inactive tab: `text-foreground-muted`, hover `text-foreground`
- Tab content area uses the standard `gap-6` section spacing

### Financial health cards
Used in Overview and per-rental-type tabs. Always appear as the **first row**.

- Four cards in a `grid grid-cols-4 gap-4`
- Each card: label (caption style, uppercase), large value (`text-3xl font-semibold`), subtext (caption, muted)
- Cards showing monetary amounts: always include currency symbol, formatted with thousands separator
- Cards showing a problem state (overdue, unpaid): label and value use `--color-status-unpaid` (red) when count > 0
- Cards showing a healthy state (paid MTD): label and value use `--color-status-completed` (green)
- Cards with neutral counts (active, total): use `--color-foreground` (default)

### At-risk payments table
Used in Daily Rentals and Leases tabs. Appears as the **second section**, below summary cards.

**Section heading:** "Payment Attention Required" — `text-lg font-medium` + count badge

**Sort order (applied client-side from API data):**
1. `paymentStatus = unpaid` AND `endDate < today` — overdue and unpaid (highest risk)
2. `paymentStatus = unpaid` AND `endDate within 30 days` — ending soon, not paid
3. `paymentStatus = partial` AND outstanding balance > 0
4. Remaining by balance descending

**Columns:**
| Column | Notes |
|--------|-------|
| Customer | Name, click → customer detail |
| Cart | Label + type |
| Start / End | Date range |
| Total | Snapshot amount |
| Paid | Sum of recorded payments |
| Balance | Total − Paid, highlighted red if > 0 |
| Status | `StatusBadge` payment variant |
| Days Overdue | Only shown if `endDate < today`, red text |
| Months Remaining | Leases tab only |
| Actions | See below |

**Inline actions (Actions column, revealed on row hover):**
- `Record Payment` — ghost button, `sm` size → opens Record Payment dialog (reuse existing payment form pattern)
- `View Rental` — ghost icon button → navigates to `/rentals/:id`
- `Contact` — ghost icon button → expands row to show customer phone + email inline; no new page or modal

**Empty state:** "No payments require attention" — standard `EmptyState` pattern, no CTA.

### Action queue panels (Overview tab)
Three panels side by side in a `grid grid-cols-3 gap-4`.

Each panel:
- Card with heading + count link ("N total — View all" → pre-filtered `/rentals?status=...`)
- List of items: customer name, cart label, scheduled time
- Each item links to `/rentals/:rentalId`
- Empty state inline (dashed border circle icon + short message — no full `EmptyState` component)
- Max 5 items shown; if more, show "and N more..." link

### Capacity tables (Inventory tab)
Standard shadcn `Table`. No actions column. Read-only. Rows are not clickable.

Column headers: label scale (uppercase, xs, medium).
Last column group (Daily / Lease rental counts) separated visually with a slightly stronger left border on the first column of the group.

---

*DESIGN.md v1.0 — Golf Cart Rental Management System*
*Update this document when new patterns are introduced. Do not diverge from it silently.*
