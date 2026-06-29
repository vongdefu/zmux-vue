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

**zmux-codex** (ZMusic) is a client-only Vue 3 music player SPA styled as an iPhone app. It searches across Netease, QQ, Kuwo, and JOOX music sources via third-party APIs and plays audio in-browser with synced LRC lyrics.

### Stack

Vue 3 (Composition API, `<script setup>`) + Vite + `@vitejs/plugin-vue`. Uses `axios` and `cheerio` for a standalone playlist scraper (`parsePlaylist.js`); the main app uses native `fetch`.

### State management

Single reactive store in `src/stores/playerStore.js` — a composable using Vue's `reactive()`. No Pinia or Vuex. The store holds all app state: search results, favorites, playlists, playback state, lyrics, and UI toggles. It is passed as a prop to every component. Track identity is keyed on `uid` (format `{source}-{songId}`), and a `trackMap` (JS `Map`) deduplicates across sources.

### Component tree

```
App.vue
├── SearchView.vue        — Search form, source toggles, interleaved results
├── LibraryView.vue       — Favorites + play history stats + track list
├── PlaylistsView.vue     — CRUD for named playlists, JSON import/export
└── PlayerDock.vue        — Mini player bar + full-screen player sheet
    ├── TrackArtwork.vue  — Cover art (3 sizes: small/medium/large) with gradient fallback
    └── IconButton.vue    — Reusable round icon button with tone variants
└── TrackList.vue         — Shared track row list (used by all 3 tab views)
```

### Service layer

- **`src/services/musicApi.js`** — Search functions per source (`searchNetease`, `searchQQ`, `searchKuwo`, `searchJoox`), a unified `searchSource()` dispatcher, and `fetchTrackDetails()` for resolving actual audio URLs + lyrics. Tracks all go through `normalizeTrack()` to a consistent shape.
- **`src/services/libraryStorage.js`** — Serializes/deserializes favorites, playlists, and play history to `localStorage` (key: `pikachu-music-library-v1`). Strips audio URLs and lyrics before persisting; only stores metadata keys.
- **`src/services/parsePlaylist.js`** — Standalone Node script (not part of the Vue app): crawls `music.163.com/discover` with cheerio, extracts playlist IDs, fetches each via the Meting API, and outputs JSON to stdout.

### Key behaviors

- **Search results interleaving**: Results from enabled sources are woven together (round-robin by source) in `interleaveTracks()` to mix up the list.
- **Playback context**: `playContext` tracks whether the user is playing from search results, favorites, or a specific playlist — determines what `nextTrack()`/`previousTrack()` operate on.
- **Quality inference**: `inferQualityFromUrl()` checks the audio URL extension for lossless formats (flac/wav/ape/alac/aiff); otherwise assumes 320k.
- **LRC parsing**: `parseLrc()` in `src/utils/lyrics.js` handles multi-timestamp lines (e.g., `[01:23.456][02:34.567]lyric text`), returning sorted `{time, text}` objects.
- **Phone-shell layout**: CSS in `src/styles/base.css` creates a desktop phone shell (430×880) with Dynamic Island. At ≤520px viewport, it goes edge-to-edge with safe-area inset support.
