# Home Page Redesign — Liquid Glass Widget Stack

**Date**: 2026-07-03  
**Status**: approved

## Overview

Redesign the home page (`HomeView.vue`) to add a liquid-glass widget container below the overview card. The container has a two-column layout: left side is a mini calendar, right side is a vertically swipeable widget stack (iOS widget-stack style). The home page itself gets an enhanced liquid glass aesthetic.

## Component Architecture

### New component tree under HomeView

```
HomeView.vue
├── (existing) hero / greeting header
├── (existing) overview card
├── LiquidGlassWidget.vue          [NEW]
│   ├── MiniCalendar.vue           [NEW]
│   └── WidgetStack.vue            [NEW]
│       ├── WidgetNowPlaying.vue    [NEW]
│       ├── WidgetPomodoro.vue      [NEW]
│       ├── WidgetSchedule.vue      [NEW]
│       └── WidgetHabit.vue         [NEW]
└── (existing) module entry list
```

### Component Responsibilities

| Component | Purpose |
|---|---|
| `LiquidGlassWidget.vue` | Glass shell, two-column layout, manages calendar expand/collapse state |
| `MiniCalendar.vue` | Left mini calendar → expanded 7-day week view on click |
| `WidgetStack.vue` | Right panel, CSS `scroll-snap-type: y mandatory` container, holds widgets |
| `WidgetNowPlaying.vue` | Shows current track, skip/favorite actions |
| `WidgetPomodoro.vue` | Shows today's pomodoro count, timer status |
| `WidgetSchedule.vue` | Shows today's incomplete tasks, toggle completion |
| `WidgetHabit.vue` | Shows today's habits, toggle completion |

## Visual Design

### Liquid Glass Effect (LiquidGlassWidget shell)

Three layers of enhancement beyond the existing `.glass` utility:

1. **Dynamic Light Caustics** — 2-3 large pseudo-elements (`::before`, `::after` on inner layers) with `filter: blur(80px)` and `border-radius: 50%`. Colors cycle through accent red (`#ec4141`), orange (`#ff9f0a`), green (`#31c27c`). Slow CSS `@keyframes` drift (20-30s period) to simulate light refracting through glass.

2. **Color Bleed** — The container's tint subtly shifts based on which widget is visible. Warm-red for Now Playing, green for Habits, orange for Schedule/Pomodoro. Uses `transition: background-color 0.8s ease` and a CSS custom property driven by the active widget index.

3. **Edge Glow** — `border: 0.5px solid rgba(255,255,255,0.15)` + inner `box-shadow` glow to create glass thickness.

Dark mode: all values adjust per the existing `--glass-*` token overrides.

### MiniCalendar

**Mini mode** (~100px wide):
- Large month display (e.g., "7月")
- Row of weekday abbreviations (一 二 三 四 五 六 日)
- Date grid below, today highlighted with `--accent` red circle background
- Current month dates in primary text, other month dates dimmed

**Expanded mode** (click toggles):
- Right widget stack hides (`opacity: 0; transform: scale(0.95)` transition)
- Calendar expands to full container width
- Shows 7-day week view with horizontal swipe (CSS scroll-snap on x axis) to move between weeks
- Each day column shows the date + summary of items for that day
- Arrow buttons at top to quick-jump weeks
- Click the left-edge collapse arrow (visible in expanded mode) to restore mini mode + widget stack. Also, tapping any date in the grid collapses back to mini mode with that date selected.

### WidgetStack

- Fixed height matching the calendar height (~280-320px), shows exactly one widget at a time
- `overflow-y: auto; scroll-snap-type: y mandatory; scroll-snap-stop: always`
- Each widget is `scroll-snap-align: start` and sized to `100%` of the container height
- Scrollbar hidden
- Vertical page indicator dots on the right edge of the widget area, highlighting the current position (1 of 4)

### Widget Cards (Now Playing / Pomodoro / Schedule / Habit)

Each widget:
- Has consistent padding and internal layout
- Shows an icon + label at top
- Has interactive content area
- Uses the existing design token system

| Widget | Content | Interactions | Empty State |
|---|---|---|
| Now Playing | Track title, artist, cover art thumbnail | Skip (next/prev), toggle favorite (heart icon) | "暂未播放"（tap → music） |
| Pomodoro | Today's session count, work/break status | View-only summary (tap navigates to pomodoro view) | "今日暂无番茄" |
| Schedule | List of today's incomplete tasks (max 3-4 visible) | Tap task to toggle completed (checkbox), shows strikethrough | "今日全部完成 ✓" |
| Habit | Today's habits with completion status | Tap habit to toggle completed for today | "暂无习惯" with add link |

### Swipe Animation

CSS scroll-snap provides native iOS-like snap physics. The scroll container uses `scroll-behavior: smooth` and the page indicator updates via `IntersectionObserver` or scroll event.

## Data Flow

- `HomeView.vue` already loads data from stores in `onMounted` (pomodoro count, incomplete tasks, habit streak, current track). These are passed as props down to the widget components.
- Widget actions (toggle habit, complete task, skip track, toggle favorite) emit events up to `HomeView`, which calls the appropriate store/service method.
- Calendar data is computed locally from `Date` — no external dependency needed.

## CSS / Design Tokens

- All new styles reference existing `var(--*)` tokens from `tokens.css`
- New liquid-glass tokens (caustic colors, blur radii, animation durations) are scoped within `LiquidGlassWidget.vue`'s `<style scoped>`
- Dark mode handled via existing `prefers-color-scheme: dark` overrides — test all new glass layers in dark mode

## Non-Goals

- Does NOT modify the existing module entry list (kept as-is below the widget)
- Does NOT add new routes or modify navigation structure
- Does NOT change any existing service/storage module
- Does NOT add new dependencies

## Success Criteria

1. Liquid glass widget container renders below the overview card with visible light caustics animation
2. Left mini calendar shows current month, today highlighted
3. Clicking mini calendar expands it to full-width 7-day view; right widgets hide
4. Right side widgets snap-vertically between Now Playing, Pomodoro, Schedule, Habits
5. Each widget shows correct live data and interactive actions work
6. Works in both light and dark mode
7. No scroll conflicts between the widget stack and the outer page scroll
8. Existing module list still renders below and works
