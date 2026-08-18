# BrowserMind — Frontend (Chrome Extension)

Manifest V3 extension. Injects a sidebar into every page for chatting with BrowserMind.

## Load unpacked (dev)

1. `chrome://extensions` → enable Developer Mode
2. "Load unpacked" → select the `frontend/` folder
3. Click the BrowserMind icon on any page to toggle the sidebar
4. Make sure the backend is running at `http://localhost:8000` (see `../backend/README.md`)

## Structure

- `manifest.json` — MV3 config, permissions, icons
- `src/background/` — service worker (tab tracking, message routing)
- `src/content/` — content script that injects the sidebar iframe into pages
- `src/sidebar/` — the chat UI (HTML/CSS/JS, iframe-based)
- `src/utils/api.js` — fetch wrapper for the backend API
- `public/icons/` — placeholder extension icons (swap with final branding)

Currently vanilla JS for simplicity. Swap in React + a bundler (Vite/esbuild) once the UI grows.
