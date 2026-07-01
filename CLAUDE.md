# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev

```bash
yarn dev        # Start dev server on 0.0.0.0:5173
yarn build      # Production build via Vite
yarn preview    # Preview production build
```

There are no tests, linters, or type-checking configured.

## Architecture

**zmux-codex** (ZMusic) is a client-only Vue 3 SPA styled as an iPhone app. It has grown beyond a music player into a multi-feature personal tool: music (search/play from Netease/QQ/Kuwo/JOOX), schedule management (week-based task trees with reports), habit tracking (contribution-graph style), and a Pomodoro timer.

### Stack

Vue 3 (Composition API, `<script setup>`) + Vite + `@vitejs/plugin-vue`. Uses `axios` and `cheerio` for a standalone playlist scraper (`parsePlaylist.js`); the main app uses native `fetch`. No Vue Router — view switching is done with `v-if` on a reactive `currentView` ref in `App.vue`.

### Navigation (no router)

`App.vue` holds a `currentView` ref (`'home'` | `'music'` | `'schedule'` | `'habit'` | `'pomodoro'` | `'profile'`). Views emit `navigate` or `back` events to switch. `HomeView.vue` is the hub — a 2×2 grid of feature blocks, each of which emits `navigate`. The `PlayerDock` is always rendered across all views.

### Component tree (current)

```
App.vue
├── HomeView.vue          — Hub: 2×2 grid linking to music / schedule / pomodoro / habit
├── MusicView.vue         — Search form, source toggles, recommended playlists, search results
│   ├── TrackList.vue     — Shared track row list
│   └── TrackArtwork.vue  — Cover art with gradient fallback
├── ProfileView.vue       — My playlists, favorites, play history (3-tab layout)
│   ├── PlaylistsView.vue — CRUD for named playlists, JSON import/export
│   └── TrackList.vue
├── ScheduleView.vue      — Week-based task trees, annual reports, per-week reports
├── HabitView.vue          — Habit tracking with contribution graph
├── PomodoroView.vue      — Pomodoro timer with settings
├── PlayerDock.vue        — Mini player bar (always visible) + full-screen player sheet
│   ├── TrackArtwork.vue
│   └── IconButton.vue    — Reusable round icon button with tone variants
```

### State management

Single reactive store in `src/stores/playerStore.js` — a composable using Vue's `reactive()`. No Pinia or Vuex. The store holds all music-related state: search results, favorites, playlists, playback state, lyrics, UI toggles, and a shared `showToast()`.

**Two import patterns coexist**: `MusicView` and `ProfileView` receive the store as a prop; `ScheduleView`, `HabitView`, and `PomodoroView` import `usePlayerStore()` directly (primarily for `showToast`).

Track identity is keyed on `uid` (format `{source}-{songId}`), and a `trackMap` (JS `Map`) deduplicates across sources.

### Service layer

**Music (original):**
- **`src/services/musicApi.js`** — Search functions per source, unified `searchSource()` dispatcher, `fetchTrackDetails()` for resolving audio URLs + lyrics, and `normalizeTrack()` for consistent track shape. Exports `sourceMeta` (labels/colors per source).
- **`src/services/libraryStorage.js`** — Serializes/deserializes favorites, playlists, and play history to `localStorage` (key: `pikachu-music-library-v1`). Strips audio URLs and lyrics before persisting.
- **`src/services/recommendedPlaylists.js`** — Fetches Netease discover page for playlist IDs via a three-tier fallback (Vite dev proxy → CORS proxy → hardcoded fallback list). Fetches playlist tracks via Meting API (`api.qijieya.cn`).
- **`src/services/parsePlaylist.js`** — Standalone Node script (not part of the Vue app): crawls `music.163.com/discover` with cheerio, extracts playlist IDs, fetches each via Meting API, outputs JSON to stdout.

**New feature modules** (each manages its own `localStorage` key):

| Module | localStorage key | Purpose |
|---|---|---|
| `scheduleStorage.js` | `zmux-schedule-v4` | Week-based task trees, auto-generation, locking, migration |
| `pomodoroStorage.js` | `zmux-pomodoro-v1` | Timer settings (work/break durations) and daily session count |
| `habitStorage.js` | `zmux-habits-v1` | Habit definitions with color, per-date completion tracking |
| `taskStorage.js` | `zmux-tasks-v1` | Simple task list (unused by schedule; potentially legacy) |

### Key behaviors

- **Search results interleaving**: Results from enabled sources are woven together (round-robin by source) in `interleaveTracks()` to mix up the list.
- **Playback context**: `playContext` tracks whether the user is playing from search results, favorites, or a specific playlist — determines what `nextTrack()`/`previousTrack()` operate on.
- **Quality inference**: `inferQualityFromUrl()` checks the audio URL extension for lossless formats (flac/wav/ape/alac/aiff); otherwise assumes 320k.
- **LRC parsing**: `parseLrc()` in `src/utils/lyrics.js` handles multi-timestamp lines (e.g., `[01:23.456][02:34.567]lyric text`), returning sorted `{time, text}` objects.
- **Schedule week logic**: `scheduleStorage.js` contains non-trivial date math — weeks are numbered from the first Monday of each year, auto-generated for 5 years (past years locked, current year generates up to this week). When a new week is created, incomplete tasks from the previous week are migrated forward. Each week has a `report` object with a `summary` field that auto-saves every 2 seconds.
- **Phone-shell layout**: CSS in `src/styles/base.css` creates a desktop phone shell (430×880) with Dynamic Island. At ≤520px viewport, it goes edge-to-edge with safe-area inset support.

### Vite proxy

The dev server proxies `/api/proxy/netease/*` → `https://music.163.com/*` with appropriate Referer headers, used by `recommendedPlaylists.js` in dev mode. In production (static hosting), it falls back to a public CORS proxy and then hardcoded playlist IDs.
