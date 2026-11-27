---
name: Traffix
colors:
  bg: "#eef0f2"
  surface: "#ffffff"
  fg: "#16191d"
  muted: "#5f6670"
  line: "#d9dde2"
  accent: "#1d3f9a"
  accent-ink: "#ffffff"
  plate: "#fbd03a"
  danger: "#b4321f"
  dark-bg: "#121418"
  dark-surface: "#1b1e24"
  dark-fg: "#eceef1"
  dark-muted: "#9aa2ad"
  dark-line: "#2c3139"
  dark-accent: "#6b8ff0"
  dark-plate: "#f0c42c"
  dark-danger: "#ef6b55"
  android: "#3ddc84"
  scrim: "rgb(10 12 16 / .55)"
  shadow-drag: "rgb(0 0 0 / .22)"
  shadow-dialog: "rgb(0 0 0 / .25)"
typography:
  display: { family: "Saira Condensed", weights: [500, 700, 800], use: "brand, headings, brand names in the list" }
  body: { family: "Barlow", weights: [400, 500, 600], size: "16px", line-height: 1.4 }
  numbers: { family: "JetBrains Mono", weights: [500, 700], use: "counts, the plate total, versions and sizes" }
radius: { plate: "6px", s: "8px", m: "10px", l: "14px", pill: "999px" }
spacing: [4, 8, 12, 16, 20, 24, 40]
---

# Design System: Traffix

## Overview

Traffix is a counter you use in a moving car, often with one hand, often in bright daylight. The whole look comes from a European number plate: a blue band, a white plate with a thick dark border, and yellow for whatever has been counted. Everything else stays quiet, light and large enough to hit without looking twice.

The app is the same on the website and in the Android APK. The website adds a side column on wide screens (Android download, GitHub). Both have the burger menu; in the APK it skips the Android download panel and ends with the app version or the pending update.

## Colors

The palette is small on purpose. Every color in the CSS comes from the variables in `:root` in `app/globals.css`; components never use raw hex values, with one exception below.

### Primary

- **Accent `#1d3f9a`** (dark mode `#6b8ff0`): the EU band blue. Used for the one primary button on screen (Save game, Download APK), focus rings, and the `RO` strip on the plate.
- **Plate `#fbd03a`** (dark mode `#f0c42c`): signal yellow. Only for counts that are above zero. It is the reward color, so it is never used for decoration.

### Neutral

- **Bg `#eef0f2`**, **surface `#ffffff`**, **line `#d9dde2`**: cool grays, all from the same hue. Surfaces sit on the background with a 1px line and, for floating panels, the shared shadow.
- **Fg `#16191d`** for text, **muted `#5f6670`** for secondary text. Muted on surface passes 4.5:1.
- **Danger `#b4321f`**: reset and delete only, always with a text label next to the color.

### Named rules

- One primary button per view. Everything else is an outline button (`.btn`).
- Brand marks keep their own colors only where the brand requires it: the Android robot is `#3ddc84`; the GitHub mark uses the text color.

## Typography

- **Saira Condensed** (display): the `TRAFFIX` wordmark (800, uppercase, +0.04em), section headings (700, uppercase, 1.4rem) and the brand names in the list (700, 1.35rem). Condensed type lets long names like Mercedes-Benz fit on a phone row.
- **Barlow** (body): 16px, 1.4 line height; hints and notes at 0.85rem with 1.5 line height; button labels 600 at 0.9rem.
- **JetBrains Mono** (numbers): every count, the plate total, version and size labels. Always `tabular-nums`, so numbers don't jump when they change.

## Layout

- One centered column, max 560px. At 1200px and up the page becomes three columns and the side column (300px, sticky) holds the panels.
- Spacing comes from 4/8: 8px between buttons, 16px between blocks, 20px inside panels, 40px between the column and the side column.
- Body has a 16px side gutter, and safe-area insets are added on top for the APK.

## Elevation & Depth

Flat by default. Only floating things get the shared shadow (`--shadow`): side panels and dialogs. The list itself is a surface with a 1px line, no shadow.

## Shapes

Plate 6px. Small controls 8px, buttons 10px, panels and the list 14px. The minus button is round; the count badge on the GitHub button is a pill.

## Components

### Buttons

`.btn`: 44px high, 10px radius, 1px line border on surface; hover darkens the border, press moves it down 1px. `.btn.primary` fills with the accent. `.btn.warn` uses the danger color and fills when armed ("Sigur?"). Labels that change ("Editează" / "Gata", "Resetează" / "Sigur?") are stacked in a grid so the button never changes width.

### Panels

`.panel`: surface, 1px line, 14px radius, 20px padding, the shared shadow. A head row (mark + uppercase heading), one short muted paragraph, then one action. Inside the menu sheet the panels lose their frame and are separated by a 1px line.

### Icons

[Phosphor](https://phosphoricons.com) for interface icons, bold weight, 18–22px. Brand marks (Android, GitHub) are the official shapes from [Simple Icons](https://simpleicons.org), never redrawn. No emoji as icons.

### Update bar

Last item in the app menu while a newer APK is waiting: accent-tinted surface, an up-arrow icon, "Actualizare disponibilă" with old → new version in mono, and one primary "Instalează" button. A small accent dot on the burger points to it. It stays until the update is installed.

### The plate

The total in the header: 2px dark border, 6px radius, blue `RO` strip on the left, the number in JetBrains Mono. It stays small; it's a badge, not a hero number.

## Do's and Don'ts

### Do

- Keep every tap target at least 44px.
- Keep text in Romanian in the app, short and plain.
- Respect `prefers-reduced-motion`: the sheet slide and count bump turn off.

### Don't

- Don't add a second accent color or gradients.
- Don't put the side column or the Android download panel into the APK view.
- Don't use yellow for anything except counts.
