# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev

```bash
yarn dev        # Start dev server on 0.0.0.0:5173
yarn build      # Production build via Vite
yarn preview    # Preview production build on 0.0.0.0
```

There are no tests, linters, or type-checking configured.

## Architecture

**zmux-codex** (ZMusic) is a client-only Vue 3 SPA styled as an iPhone app. Features: music search/play (Netease/QQ/Kuwo/JOOX), schedule management (week-based task trees with reports), habit tracking (contribution-graph style), Pomodoro timer, accounting (expense tracking), and a calendar with events.

### Stack

Vue 3 (Composition API, `<script setup>`) + Vite + `@vitejs/plugin-vue`. Uses `axios` and `cheerio` only for a standalone playlist scraper (`parsePlaylist.js`); the main app uses native `fetch`. No Vue Router — view switching uses `v-if` on a reactive `currentView` ref in `App.vue`.

### CSS & Design Tokens

Two CSS files loaded in order in `main.js`:

1. **`src/styles/tokens.css`** — Design tokens as CSS custom properties on `:root`. iOS-inspired visual language with Apple Music red accent (`#ec4141`). Defines radii (`--radius-sm/md/lg/full`), spacing scale (`--space-xs` through `--space-xl`), type scale (`--text-large-title` through `--text-caption`), surface/separator/text colors, and glass effect primitives. Includes `prefers-color-scheme: dark` overrides. Also exports a `.glass` utility class (blurred backdrop with semi-transparent background).

2. **`src/styles/base.css`** — Reset, phone shell container (`.phone-app` at `max-width: 430px`, centered on desktop), toast component styles, scrollbar hiding utilities.

**Design tokens must be referenced via `var(--name)`** — never hardcode colors or spacing values that have a corresponding token.

### Navigation

`App.vue` holds a `currentView` ref (`'home'` | `'music'` | `'schedule'` | `'habit'` | `'pomodoro'` | `'accounting'` | `'calendar'` | `'profile'`). Views emit `navigate` or `back` events to switch.

**Two-tier navigation:**

- **TabBar** (bottom, glass-style) — visible on all views except `profile` and `calendar`. Has 5 tabs: music, schedule, pomodoro, habit, accounting. Hidden on profile/calendar to make room for their internal navigation.
- **HomeView** — grid hub that can also launch any view. Music view has a back-arrow to return to home.

`PlayerDock` is rendered across all views. When the user navigates away from music/profile/accounting, the full-screen player auto-closes. The mini player dock only shows on music, profile, and accounting views.

### Component tree

```
App.vue
├── HomeView.vue              — Greeting, today overview cards, LiquidGlassWidget, module entry grid
│   └── LiquidGlassWidget.vue — Glass-morphism card wrapping MiniCalendar + WidgetStack
│       ├── MiniCalendar.vue  — Compact inline calendar with expand/collapse
│       └── WidgetStack.vue   — Horizontal swipeable stack of 4 widgets
│           ├── WidgetNowPlaying.vue — Current track info + controls
│           ├── WidgetPomodoro.vue   — Today's pomodoro count
│           ├── WidgetSchedule.vue   — Today's incomplete tasks
│           └── WidgetHabit.vue      — Today's habit checkboxes
├── MusicView.vue             — Search bar, source toggles, recommended playlists (browse → detail), search results
│   └── TrackList.vue         — Shared track row list
├── ScheduleView.vue          — Week-based task trees, annual reports, per-week reports
├── HabitView.vue             — Habit tracking with contribution graph (GitHub-style)
├── PomodoroView.vue          — Pomodoro timer with circular progress
├── AccountingView.vue        — Expense/income tracking with summary and charts
├── CalendarView.vue          — Monthly calendar with event management
│   ├── calendar/CalendarList.vue  — Searchable event list
│   ├── calendar/MonthGrid.vue     — Month grid with event dots
│   ├── calendar/DayView.vue       — Single day detail
│   ├── calendar/WeekView.vue      — Week view
│   ├── calendar/EventSheet.vue    — Event create/edit sheet
│   └── calendar/MiniEventCard.vue — Compact event card
├── ProfileView.vue           — 3-tab layout: playlists, favorites, play history
│   ├── PlaylistsView.vue     — CRUD for named playlists, JSON import/export
│   └── TrackList.vue
├── PlayerDock.vue            — Mini player bar + full-screen player sheet (lyrics, progress, controls)
│   ├── TrackArtwork.vue      — Cover art with gradient fallback
│   └── IconButton.vue        — Reusable round icon button with tone variants
└── TabBar.vue                — Bottom tab bar (music/schedule/pomodoro/habit/accounting), glass effect
```

**Legacy/unused:** `SearchView.vue` and `LibraryView.vue` are not imported by any current view.

### State management

Single reactive store in `src/stores/playerStore.js` — a composable using Vue's `reactive()`. No Pinia or Vuex. The store holds all music-related state: search results, favorites, playlists, playback state, lyrics, UI toggles, recommended playlists, and a shared `showToast()`.

**Two import patterns coexist**: `MusicView` and `ProfileView` receive the store as a prop (`:store`); all other views import `usePlayerStore()` directly (primarily for `showToast`).

Track identity is keyed on `uid` (format `{source}-{songId}`), and a `trackMap` (JS `Map`) deduplicates across sources. The `trackMap` is rebuilt from favorites, play history, playlist tracks, and recommended playlist tracks on store initialization.

### Service layer

**Music:**
- `src/services/musicApi.js` — Search functions per source, unified `searchSource()` dispatcher, `fetchTrackDetails()` for resolving audio URLs + lyrics, and `normalizeTrack()` for consistent track shape. Exports `sourceMeta` (labels/colors per source).
- `src/services/libraryStorage.js` — Serializes/deserializes favorites, playlists, and play history to `localStorage` (key: `pikachu-music-library-v1`). Strips audio URLs and lyrics before persisting.
- `src/services/recommendedPlaylists.js` — Fetches Netease discover page for playlist IDs via a three-tier fallback (Vite dev proxy → CORS proxy → hardcoded fallback list). Fetches playlist tracks via Meting API (`api.qijieya.cn`).
- `src/services/parsePlaylist.js` — Standalone Node script (not part of the Vue app): crawls `music.163.com/discover` with cheerio, extracts playlist IDs, fetches each via Meting API, outputs JSON to stdout.

**Feature modules** (each manages its own `localStorage` key):

| Module | localStorage key | Purpose |
|---|---|---|
| `scheduleStorage.js` | `zmux-schedule-v4` | Week-based task trees, auto-generation, locking, migration |
| `pomodoroStorage.js` | `zmux-pomodoro-v1` | Timer settings (work/break durations) and daily session count |
| `habitStorage.js` | `zmux-habits-v1` | Habit definitions with color, per-date completion tracking |
| `accountingStorage.js` | `zmux-accounting-v1` | Expense/income records with categories |
| `calendarStorage.js` | `zmux-calendar-v1` | Calendar events with date, title, description, color |
| `taskStorage.js` | `zmux-tasks-v1` | Simple task list (unused by schedule; potentially legacy) |

### Key behaviors

- **Search results interleaving**: Results from enabled sources are woven together (round-robin by source) in `interleaveTracks()` so the list mixes sources rather than grouping them.
- **Playback context**: `playContext` tracks whether the user is playing from search results, favorites, a user playlist, or a recommended playlist — determines what `nextTrack()`/`previousTrack()` operate on.
- **Quality inference**: `inferQualityFromUrl()` checks the audio URL extension for lossless formats (flac/wav/ape/alac/aiff); otherwise assumes 320k.
- **LRC parsing**: `parseLrc()` in `src/utils/lyrics.js` handles multi-timestamp lines (e.g., `[01:23.456][02:34.567]lyric text`), returning sorted `{time, text}` objects.
- **Schedule week logic**: `scheduleStorage.js` contains non-trivial date math — weeks are numbered from the first Monday of each year, auto-generated for 5 years (past years locked, current year generates up to this week). When a new week is created, incomplete tasks from the previous week are migrated forward. Each week has a `report` object with a `summary` field that auto-saves every 2 seconds.
- **Phone-shell layout**: `.phone-app` constrains the app to `max-width: 430px` and centers it on desktop. At narrow viewports it goes edge-to-edge. Uses `100dvh` for dynamic viewport height and `safe-area-inset-*` for notched devices.
- **Toast system**: `store.showToast(message)` shows a pill-shaped toast that auto-dismisses after 2.2 seconds. Used by all views for user feedback.

### Vite proxy

The dev server proxies `/api/proxy/netease/*` → `https://music.163.com/*` with `secure: false` (to tolerate local proxy self-signed certs), `changeOrigin: true`, and appropriate Referer headers. Used by `recommendedPlaylists.js` in dev mode. In production (static hosting), falls back to a public CORS proxy and then hardcoded playlist IDs.
