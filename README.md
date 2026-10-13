# Crunchyroll Clone

A fan-made Crunchyroll-style anime streaming site built with HTML, Tailwind CSS and vanilla JavaScript. Anime data comes from the [AniList API](https://anilist.co).

> Demo project only. Crunchyroll is a trademark of Crunchyroll, LLC.

## Features

- Hero carousel with auto-advance and swipe support
- Rows of popular, trending, seasonal and top-rated anime
- Hover details panel on poster cards (desktop)
- Categories menu with genre browsing
- Live search
- Release calendar
- Watchlist and continue-watching history (saved in your browser)
- Anime page with episode list and video player

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page layout, header, footer and modals |
| `styles.css` | Custom styles (hero, hover panel, menus) |
| `script.js` | App logic: data fetching, rendering, search, player |
| `manifest.json` | Web App Manifest for PWA installation |
| `sw.js` | Service worker for offline handling & PWA install |
| `assets/` | App icons, favicon and maskable icons |

## Run it

1. Put all the files in the same folder.
2. Open `index.html` in your browser, or serve the folder with a local server:

   ```bash
   python -m http.server 8000
   ```

   Then visit `http://localhost:8000`.

An internet connection is required (Tailwind, FontAwesome, fonts and the AniList API load from the web).

## Change the video player

Open `script.js` and edit the player URL at the very top of the file. The `{id}`, `{episode}` and `{audio}` placeholders are filled in automatically.

## Credits

- Anime data: [AniList](https://anilist.co)
- Icons: [Font Awesome](https://fontawesome.com)
- Styling: [Tailwind CSS](https://tailwindcss.com)
