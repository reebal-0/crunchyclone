/* ==========================================================================
   PLAYER CONFIG  -  EDIT THIS TO USE A DIFFERENT PLAYER
   ==========================================================================

   This is the URL loaded inside the video iframe. Replace it with any
   player's URL pattern. These placeholders are filled in automatically:

     {id}       -> AniList ID of the anime   (e.g. 21)
     {episode}  -> episode number            (e.g. 1)
     {audio}    -> 'sub' or 'dub'

   Examples:
     'https://ratingsandtrailers.com/anime/{id}/{episode}/{audio}'
     'https://other-player.com/embed/{id}?ep={episode}&lang={audio}'
   ========================================================================== */

   const PLAYER_URL_TEMPLATE = 'https://ratingsandtrailers.com/anime/{id}/{episode}/{audio}';


   /* ==========================================================================
      Crunchyroll Clone - application logic
   
      Sections:
        1. State & constants
        2. Fallback (mock) data
        3. Data fetching (AniList GraphQL API)
        4. Small helpers
        5. Watchlist & watch history
        6. HTML template builders (cards, rows, hero)
        7. Pages: home, browse / category / search, release calendar
        8. Hero carousel
        9. Header: search, menus
       10. Anime page / video player
       11. Watchlist popup
       12. App start
      ========================================================================== */
   
   
   /* ==========================================================================
      1. STATE & CONSTANTS
      ========================================================================== */
   
   const STORAGE_KEYS = {
       watchlist: 'crunchy_watchlist',
       history: 'crunchy_history'
   };
   
   // Left/right page padding used by every full-width section
   const PAGE_PADDING_X = 'px-4 sm:px-8 lg:px-16 xl:px-20';
   
   // Auto-advance time of the hero carousel (also set in style.css as --hero-interval)
   const HERO_INTERVAL_MS = 7000;
   
   // Genres shown in the Categories menu.
   // `genre` filters by AniList genre, `tag` filters by AniList tag (used for demographics).
   const GENRES = [
       { label: 'Action',       genre: 'Action' },
       { label: 'Adventure',    genre: 'Adventure' },
       { label: 'Comedy',       genre: 'Comedy' },
       { label: 'Drama',        genre: 'Drama' },
       { label: 'Fantasy',      genre: 'Fantasy' },
       { label: 'Music',        genre: 'Music' },
       { label: 'Romance',      genre: 'Romance' },
       { label: 'Sci-Fi',       genre: 'Sci-Fi' },
       { label: 'Seinen',       tag: 'Seinen' },
       { label: 'Shojo',        tag: 'Shoujo' },
       { label: 'Shonen',       tag: 'Shounen' },
       { label: 'Slice of life', genre: 'Slice of Life' },
       { label: 'Sports',       genre: 'Sports' },
       { label: 'Supernatural', genre: 'Supernatural' },
       { label: 'Thriller',     genre: 'Thriller' }
   ];
   
   // Every anime loaded so far, by id (so the player, watchlist and history can find it)
   const animeIndex = new Map();
   
   // Lists shown on the home page
   const homeData = { trending: [], popular: [], topRated: [], season: [] };
   
   // Saved in the browser (localStorage)
   let watchlist = readStoredList(STORAGE_KEYS.watchlist);
   let watchHistory = readStoredList(STORAGE_KEYS.history);
   
   // Which page is showing: 'home' or 'browse'
   let currentView = 'home';
   
   // State of the anime page / video player
   const currentModalState = {
       animeId: null,
       selectedEpisode: 1,
       audioType: 'sub'   // 'sub' or 'dub'
   };
   let historyTimer = null;
   
   // State of the hero carousel
   const heroState = { items: [], index: 0, timer: null };
   
   // State of the browse / category / search page
   const browseState = {
       token: 0,          // changes whenever the page changes, so old responses are ignored
       loader: null,      // function(page) -> Promise<{ items, hasNext }>
       page: 0,
       hasNext: false,
       loading: false,
       count: 0,
       seen: new Set(),
       activeGenre: null,
       isSearch: false,
       emptyMessage: 'No anime found.'
   };
   
   let searchDebounceTimer = null;
   let lastSearchQuery = '';
   let categoriesCloseTimer = null;
   
   
   /* ==========================================================================
      2. FALLBACK (MOCK) DATA
      Used when the AniList API can't be reached.
      ========================================================================== */
   
   const MOCK_ANIME_DATA = [
       {
           id: 21,
           title: { english: "One Piece", romaji: "One Piece" },
           coverImage: { large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/nx21-tXMN3Y20PIL9.jpg" },
           bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VrvKCkMU.jpg",
           description: "Gold Roger was known as the Pirate King, the strongest and most infamous beast to have sailed the Grand Line.",
           averageScore: 88,
           episodes: 1100,
           genres: ["Action", "Adventure", "Comedy"],
           status: "RELEASING",
           seasonYear: 1999
       },
       {
           id: 16498,
           title: { english: "Attack on Titan", romaji: "Shingeki no Kyojin" },
           coverImage: { large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-m9x3WUMhyYUT.jpg" },
           bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-IgsKJIazvVtE.jpg",
           description: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans.",
           averageScore: 92,
           episodes: 25,
           genres: ["Action", "Drama", "Fantasy"],
           status: "FINISHED",
           seasonYear: 2013
       },
       {
           id: 1535,
           title: { english: "Death Note", romaji: "Death Note" },
           coverImage: { large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-lawytVr1UhNP.png" },
           bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/1535-4856fWwY1zM3.jpg",
           description: "A brilliant student finds a supernatural notebook that kills anyone whose name is written in it.",
           averageScore: 86,
           episodes: 37,
           genres: ["Mystery", "Psychological", "Thriller"],
           status: "FINISHED",
           seasonYear: 2006
       },
       {
           id: 101922,
           title: { english: "Demon Slayer: Kimetsu no Yaiba", romaji: "Kimetsu no Yaiba" },
           coverImage: { large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTc93blC.jpg" },
           bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-2v48JbWjV9Vb.jpg",
           description: "Tanjiro sets out to become a demon slayer after his family is slaughtered and his sister turned into a demon.",
           averageScore: 87,
           episodes: 26,
           genres: ["Action", "Adventure", "Fantasy"],
           status: "FINISHED",
           seasonYear: 2019
       },
       {
           id: 113415,
           title: { english: "Jujutsu Kaisen", romaji: "Jujutsu Kaisen" },
           coverImage: { large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFqSn.jpg" },
           bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-uT128Y9q0j3S.jpg",
           description: "A boy swallows a cursed talisman and becomes cursed himself, entering a magical school to exorcise curses.",
           averageScore: 91,
           episodes: 24,
           genres: ["Action", "Fantasy", "Drama"],
           status: "FINISHED",
           seasonYear: 2020
       },
       {
           id: 164760,
           title: { english: "Solo Leveling", romaji: "Ore dake Level Up na Ken" },
           coverImage: { large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx164760-bV1cWwKj8V2x.jpg" },
           bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/164760-L9M3S2z1v5Q.jpg",
           description: "In a world where hunters battle deadly monsters, weak hunter Sung Jinwoo finds himself in a struggle for survival.",
           averageScore: 89,
           episodes: 12,
           genres: ["Action", "Adventure", "Fantasy"],
           status: "RELEASING",
           seasonYear: 2024
       }
   ];
   
   
   /* ==========================================================================
      3. DATA FETCHING (AniList GraphQL API)
      ========================================================================== */
   
   // The fields we request for every anime in every query
   const MEDIA_FIELDS = `
       id
       title { romaji english native }
       coverImage { extraLarge large color }
       bannerImage
       description
       averageScore
       episodes
       genres
       status
       seasonYear
       popularity
       format
   `;
   
   // Home page: four lists in one request
   const homeQuery = `
   query ($season: MediaSeason, $seasonYear: Int) {
       trending: Page(page: 1, perPage: 20) {
           media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
       }
       popular: Page(page: 1, perPage: 20) {
           media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
       }
       topRated: Page(page: 1, perPage: 20) {
           media(sort: SCORE_DESC, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
       }
       season: Page(page: 1, perPage: 20) {
           media(season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
       }
   }`;
   
   // Browse / category / search pages: any combination of filters, one page at a time
   const browseQuery = `
   query ($page: Int, $perPage: Int, $search: String, $genre_in: [String], $tag_in: [String],
          $sort: [MediaSort], $status: MediaStatus, $format: MediaFormat,
          $season: MediaSeason, $seasonYear: Int) {
       Page(page: $page, perPage: $perPage) {
           pageInfo { hasNextPage }
           media(type: ANIME, isAdult: false, search: $search, genre_in: $genre_in, tag_in: $tag_in,
                 sort: $sort, status: $status, format: $format, season: $season, seasonYear: $seasonYear) {
               ${MEDIA_FIELDS}
           }
       }
   }`;
   
   // Release calendar: episodes airing in the next 7 days
   const calendarQuery = `
   query ($page: Int, $perPage: Int, $from: Int, $to: Int) {
       Page(page: $page, perPage: $perPage) {
           pageInfo { hasNextPage }
           airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
               airingAt
               episode
               media { isAdult ${MEDIA_FIELDS} }
           }
       }
   }`;
   
   /**
    * Sends a GraphQL request to AniList and returns the parsed `data` object.
    * Throws if the request fails or times out.
    */
   async function requestAniList(query, variables = {}, timeoutMs = 8000) {
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
   
       try {
           const response = await fetch('https://graphql.anilist.co', {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json',
                   'Accept': 'application/json'
               },
               body: JSON.stringify({ query, variables }),
               signal: controller.signal
           });
   
           if (!response.ok) throw new Error(`AniList responded with status ${response.status}`);
   
           const result = await response.json();
           if (result.errors) throw new Error(result.errors[0].message);
           return result.data;
       } finally {
           clearTimeout(timeoutId);
       }
   }
   
   /** Remembers anime so they can be found again by id. */
   function registerAnime(list) {
       list.forEach(anime => animeIndex.set(anime.id, anime));
   }
   
   /** Season (WINTER / SPRING / SUMMER / FALL) and year of today's date. */
   function getCurrentSeason() {
       const now = new Date();
       const month = now.getMonth();   // 0 = January
       const season = month <= 2 ? 'WINTER' : month <= 5 ? 'SPRING' : month <= 8 ? 'SUMMER' : 'FALL';
       return { season, year: now.getFullYear() };
   }
   
   /**
    * Loads the home page lists from AniList (falls back to the built-in dataset
    * if AniList can't be reached), then shows the home page.
    */
   async function loadHome() {
       const { season, year } = getCurrentSeason();
   
       try {
           const data = await requestAniList(homeQuery, { season, seasonYear: year });
   
           homeData.trending = data.trending.media;
           homeData.popular = data.popular.media;
           homeData.topRated = data.topRated.media;
           homeData.season = data.season.media;
       } catch (err) {
           console.warn('AniList API fetch failed. Using built-in fallback dataset.', err);
   
           homeData.trending = MOCK_ANIME_DATA.slice(0, 6);
           homeData.popular = MOCK_ANIME_DATA.slice(1, 6).concat(MOCK_ANIME_DATA[0]);
           homeData.topRated = MOCK_ANIME_DATA.slice();
           homeData.season = MOCK_ANIME_DATA.slice(3, 6);
       }
   
       Object.values(homeData).forEach(registerAnime);
   
       showHome();
       updateWatchlistCount();
   }
   
   /** Loads one page of results for the browse / category / search pages. */
   async function fetchBrowsePage(filters, page) {
       const data = await requestAniList(browseQuery, { ...filters, page, perPage: 30 });
       registerAnime(data.Page.media);
   
       return {
           items: data.Page.media,
           hasNext: data.Page.pageInfo.hasNextPage
       };
   }
   
   /** Loads one page of the release calendar (episodes airing in the next 7 days). */
   async function fetchCalendarPage(page) {
       const now = Math.floor(Date.now() / 1000);
       const data = await requestAniList(calendarQuery, {
           page,
           perPage: 50,
           from: now,
           to: now + 7 * 24 * 60 * 60
       });
   
       const schedules = data.Page.airingSchedules.filter(entry => entry.media && !entry.media.isAdult);
       registerAnime(schedules.map(entry => entry.media));
   
       return {
           // Each item is the anime plus the details of the episode that is airing
           items: schedules.map(entry => ({ ...entry.media, _airing: { episode: entry.episode, at: entry.airingAt } })),
           hasNext: data.Page.pageInfo.hasNextPage
       };
   }
   
   /**
    * Builds the player URL for an anime episode using PLAYER_URL_TEMPLATE
    * (defined at the top of this file).
    */
   function getAnimeStreamUrl(anilistId, episodeNumber, audioType) {
       return PLAYER_URL_TEMPLATE
           .replace('{id}', anilistId)
           .replace('{episode}', episodeNumber)
           .replace('{audio}', audioType);
   }
   
   
   /* ==========================================================================
      4. SMALL HELPERS
      ========================================================================== */
   
   /** Placeholder poster used when an image is missing or fails to load. */
   function getFallbackPosterUrl(title) {
       const encodedTitle = encodeURIComponent(title || 'Anime').replace(/'/g, '%27');
       return `https://placehold.co/400x600/141414/ff640a?text=${encodedTitle}`;
   }
   
   /** Best available display title (plain text - use escapeHtml before putting it in HTML). */
   function getTitle(anime) {
       return anime.title.english || anime.title.romaji || 'Anime';
   }
   
   /** Cover image URL (falls back to a placeholder). */
   function getCover(anime) {
       const image = anime.coverImage;
       if (image && (image.large || image.extraLarge)) {
           return image.large || image.extraLarge;
       }
       return getFallbackPosterUrl(getTitle(anime));
   }
   
   /** Wide image for thumbnails (banner if there is one, otherwise the cover). */
   function getWideImage(anime) {
       return anime.bannerImage || getCover(anime);
   }
   
   /** Score converted from 0-100 to 0-10, e.g. "8.8". */
   function getScore(anime) {
       return anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
   }
   
   /** Escapes text before it is placed inside HTML. */
   function escapeHtml(text) {
       return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
   }
   
   /** Makes an image URL safe to use inside style="background-image:url('...')". */
   function cssUrl(url) {
       return String(url).replace(/'/g, '%27');
   }
   
   /** Removes HTML tags from the API's description text. */
   function stripHtml(text) {
       return text.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
   }
   
   function capitalize(text) {
       return text.charAt(0) + text.slice(1).toLowerCase();
   }
   
   /** Finds an anime by id. */
   function findAnimeById(animeId) {
       return animeIndex.get(animeId);
   }
   
   /** Reads a saved array from localStorage (returns [] if missing or broken). */
   function readStoredList(key) {
       try {
           const value = JSON.parse(localStorage.getItem(key) || '[]');
           return Array.isArray(value) ? value : [];
       } catch (err) {
           return [];
       }
   }
   
   /** Saves a value to localStorage (ignores errors such as a full disk quota). */
   function writeStored(key, value) {
       try {
           localStorage.setItem(key, JSON.stringify(value));
       } catch (err) {
           console.warn('Could not save to localStorage', err);
       }
   }
   
   
   /* ==========================================================================
      5. WATCHLIST & WATCH HISTORY
      ========================================================================== */
   
   function isInWatchlist(animeId) {
       return watchlist.some(item => item.id === animeId);
   }
   
   /** Adds the anime to the watchlist, or removes it if already there. */
   function toggleWatchlist(animeId) {
       const anime = findAnimeById(animeId);
       if (!anime) return;
   
       const index = watchlist.findIndex(item => item.id === animeId);
       if (index > -1) {
           watchlist.splice(index, 1);
       } else {
           // Save a clean copy (without calendar details)
           const { _airing, ...cleanAnime } = anime;
           watchlist.push(cleanAnime);
       }
   
       writeStored(STORAGE_KEYS.watchlist, watchlist);
       updateWatchlistCount();
       refreshWatchlistButtons(animeId);
   }
   
   /**
    * A watchlist button. There are two looks:
    *   'icon' - just a bookmark icon (cards, hero)
    *   'full' - icon + text (anime page)
    */
   function createWatchlistButton(animeId, variant, classes) {
       return `
           <button type="button" data-watchlist-btn="${animeId}" data-variant="${variant}" title="Watchlist"
                   onclick="event.stopPropagation(); toggleWatchlist(${animeId})" class="${classes}">
               ${getWatchlistButtonContent(animeId, variant)}
           </button>
       `;
   }
   
   function getWatchlistButtonContent(animeId, variant) {
       const inList = isInWatchlist(animeId);
   
       if (variant === 'full') {
           return `
               <i class="fa-solid ${inList ? 'fa-check text-crunchy' : 'fa-plus'}"></i>
               <span>${inList ? 'In Watchlist' : 'Add to Watchlist'}</span>
           `;
       }
       return `<i class="${inList ? 'fa-solid text-crunchy' : 'fa-regular'} fa-bookmark"></i>`;
   }
   
   /** Updates every watchlist button for this anime (cards, hero, anime page). */
   function refreshWatchlistButtons(animeId) {
       document.querySelectorAll(`[data-watchlist-btn="${animeId}"]`).forEach(button => {
           button.innerHTML = getWatchlistButtonContent(animeId, button.dataset.variant);
       });
   }
   
   /** Updates the counter badge on the header's bookmark icon. */
   function updateWatchlistCount() {
       const badge = document.getElementById('watchlist-count');
       if (!badge) return;
   
       badge.innerText = watchlist.length;
       badge.classList.toggle('hidden', watchlist.length === 0);
   }
   
   /** Remembers the episode the person is watching (shown in "Continue Watching"). */
   function saveHistory(anime, episode, audio) {
       const { _airing, ...cleanAnime } = anime;
   
       watchHistory = watchHistory.filter(entry => entry.anime.id !== anime.id);
       watchHistory.unshift({ anime: cleanAnime, episode, audio, at: Date.now() });
       watchHistory = watchHistory.slice(0, 20);
   
       writeStored(STORAGE_KEYS.history, watchHistory);
   }
   
   function findHistory(animeId) {
       return watchHistory.find(entry => entry.anime.id === animeId) || null;
   }
   
   
   /* ==========================================================================
      6. HTML TEMPLATE BUILDERS (cards, rows, hero)
      ========================================================================== */
   
   /** Text under a card's title, e.g. "Sub | Dub" or "E5 • Sun 3:30 PM" on the calendar. */
   function getCardSubtitle(anime) {
       if (anime._airing) {
           const time = new Date(anime._airing.at * 1000).toLocaleString([], {
               weekday: 'short', hour: 'numeric', minute: '2-digit'
           });
           return `E${anime._airing.episode} • ${time}`;
       }
       return 'Sub | Dub';
   }
   
   /** 1234 -> "1.2K", 432100 -> "432.1K" */
   function formatCount(n) {
       if (!n) return '';
       if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
       if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
       return String(n);
   }

   /**
    * One poster card. Clicking it opens the anime page.
    * On desktop, hovering shows a details panel over the card (like Crunchyroll).
    * `fluid` cards fill their grid cell; the others have a fixed width (for scrolling rows).
    */
   function createAnimeCard(anime, { fluid = false } = {}) {
       const title = escapeHtml(getTitle(anime));
       const widthClasses = fluid
           ? 'w-full'
           : 'snap-start shrink-0 w-[42vw] max-w-[190px] sm:w-44 sm:max-w-none lg:w-52 xl:w-56 2xl:w-[266px]';

       const score = getScore(anime);
       const votes = formatCount(anime.popularity);
       const ratingLine = score === 'N/A' ? '' :
           `<p class="card-hover-meta">${score} <i class="fa-solid fa-star text-[11px]"></i>${votes ? ` <span>(${votes})</span>` : ''}</p>`;
       const formatLabel = anime.format ? capitalize(anime.format.replace(/_/g, ' ').toLowerCase()) : '';
       const infoLine = [formatLabel, anime.seasonYear].filter(Boolean).join(' \u2022 ');
       const episodesLine = anime.episodes ? `${anime.episodes} Episode${anime.episodes === 1 ? '' : 's'}` : '';
       const description = anime.description ? escapeHtml(stripHtml(anime.description)) : 'No description available.';

       return `
           <article class="group anime-card cursor-pointer ${widthClasses}" onclick="openAnimeModal(${anime.id})">
               <div class="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                   <img src="${getCover(anime)}" alt="${title}" loading="lazy"
                        class="w-full h-full object-cover"
                        onerror="this.onerror=null; this.src='${getFallbackPosterUrl(getTitle(anime))}';">
                   ${createWatchlistButton(anime.id, 'icon',
                       'card-touch-bookmark absolute top-2 right-2 w-8 h-8 rounded bg-black/70 hover:bg-black items-center justify-center text-sm')}
               </div>
               <h3 class="mt-3 text-sm font-bold line-clamp-1">${title}</h3>
               <p class="mt-1 text-sm text-gray-400 line-clamp-1">${getCardSubtitle(anime)}</p>

               <div class="card-hover" aria-hidden="true">
                   <h4 class="card-hover-title">${title}</h4>
                   ${ratingLine}
                   ${infoLine ? `<p class="card-hover-info">${infoLine}</p>` : ''}
                   ${episodesLine ? `<p class="card-hover-info">${episodesLine}</p>` : ''}
                   <p class="card-hover-desc">${description}</p>
                   <div class="card-hover-actions">
                       <button type="button" title="Watch" onclick="event.stopPropagation(); openAnimeModal(${anime.id})"><i class="fa-regular fa-circle-play"></i></button>
                       ${createWatchlistButton(anime.id, 'icon', '')}
                   </div>
               </div>
           </article>
       `;
   }
   
   /** A wide "Continue Watching" card showing the last episode watched. */
   function createContinueCard(entry) {
       const anime = entry.anime;
       const title = escapeHtml(getTitle(anime));
   
       return `
           <article class="group cursor-pointer snap-start shrink-0 w-64 sm:w-72 lg:w-80" onclick="openAnimeModal(${anime.id})">
               <div class="relative aspect-video overflow-hidden bg-[#1a1a1a]">
                   <img src="${getWideImage(anime)}" alt="${title}" loading="lazy"
                        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onerror="this.onerror=null; this.src='${getFallbackPosterUrl(getTitle(anime))}';">
                   <span class="absolute bottom-2 right-2 bg-black/80 text-xs font-bold px-1.5 py-0.5 rounded">
                       E${entry.episode} • ${entry.audio.toUpperCase()}
                   </span>
               </div>
               <p class="mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400 line-clamp-1">${title}</p>
               <h3 class="mt-1 text-[15px] font-bold line-clamp-1 group-hover:text-crunchy transition-colors">Episode ${entry.episode}</h3>
           </article>
       `;
   }
   
   /**
    * A horizontally scrolling row with a heading, a "View all" link and
    * arrow buttons (desktop). `cardsHtml` is the already-built list of cards.
    */
   function createCarouselRow(title, cardsHtml, viewAllLabel, viewAllAction) {
       const arrowClasses = 'hidden md:flex absolute top-0 h-[calc(100%-3.5rem)] w-14 items-center justify-center text-2xl text-white ' +
           'opacity-0 group-hover/row:opacity-100 transition-opacity z-10';
   
       return `
           <section class="space-y-4">
               <div class="flex items-end justify-between gap-4">
                   <h2 class="text-xl sm:text-2xl lg:text-[28px] font-bold leading-tight">${title}</h2>
                   <button onclick="${viewAllAction}" class="shrink-0 text-xs font-bold tracking-wider uppercase text-gray-400 hover:text-white transition-colors">
                       ${viewAllLabel} <i class="fa-solid fa-chevron-right text-[10px] ml-1"></i>
                   </button>
               </div>
               <div class="relative group/row">
                   <button onclick="scrollRow(this, -1)" aria-label="Scroll left" class="${arrowClasses} left-0 bg-gradient-to-r from-black/80 to-transparent">
                       <i class="fa-solid fa-chevron-left"></i>
                   </button>
                   <div data-row class="card-row flex gap-3 sm:gap-5 lg:gap-[30px] overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory">
                       ${cardsHtml}
                   </div>
                   <button onclick="scrollRow(this, 1)" aria-label="Scroll right" class="${arrowClasses} right-0 bg-gradient-to-l from-black/80 to-transparent">
                       <i class="fa-solid fa-chevron-right"></i>
                   </button>
               </div>
           </section>
       `;
   }
   
   /** Scrolls a row left (-1) or right (1) when its arrow is clicked. */
   function scrollRow(button, direction) {
       const row = button.parentElement.querySelector('[data-row]');
       if (row) row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: 'smooth' });
   }
   
   /** A carousel row of poster cards, or '' if there is nothing to show. */
   function createAnimeRow(title, animeList, viewAllKey) {
       if (!animeList || animeList.length === 0) return '';
       return createCarouselRow(
           title,
           animeList.map(anime => createAnimeCard(anime)).join(''),
           'View all',
           `openNav('${viewAllKey}')`
       );
   }
   
   /** The "Continue Watching" row (empty until the person has watched something). */
   function createContinueRow() {
       if (watchHistory.length === 0) return '';
       return createCarouselRow(
           'Continue Watching',
           watchHistory.map(createContinueCard).join(''),
           'View history',
           `openNav('history')`
       );
   }
   
   /** One slide of the hero carousel. */
   function createHeroSlide(anime, index) {
       const title = escapeHtml(getTitle(anime));
       const hasBanner = Boolean(anime.bannerImage);
       const background = cssUrl(hasBanner ? anime.bannerImage : getCover(anime));
       const saved = findHistory(anime.id);
       const buttonLabel = saved ? `Continue Watching E${saved.episode}` : 'Start Watching E1';
       const genres = anime.genres ? anime.genres.slice(0, 3).join(', ') : '';
       const description = anime.description ? stripHtml(anime.description) : 'No description available.';
   
       // Banners are wide; if an anime has none we show a blurred cover plus a poster instead
       const posterHtml = hasBanner ? '' : `
           <img src="${getCover(anime)}" alt="" class="hidden md:block absolute right-16 xl:right-40 top-1/2 -translate-y-1/2 h-[78%] aspect-[2/3] object-cover rounded shadow-2xl">
       `;
   
       return `
           <div class="hero-slide ${index === 0 ? 'is-active' : ''}">
               <div class="absolute inset-0 bg-cover bg-center ${hasBanner ? '' : 'scale-110 blur-xl'}" style="background-image: url('${background}');"></div>
               ${posterHtml}
               <div class="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"></div>
               <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30"></div>
   
               <div class="relative z-10 h-full flex items-end ${PAGE_PADDING_X} pb-52 sm:pb-60">
                   <div class="max-w-xl lg:max-w-[600px] space-y-3">
                       <h1 class="text-3xl sm:text-5xl font-black leading-tight line-clamp-2">${title}</h1>
                       <p class="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-gray-400">
                           <span class="bg-white/15 text-gray-200 rounded px-1.5 py-0.5 font-bold">★ ${getScore(anime)}</span>
                           <span>• Sub | Dub</span>
                           ${genres ? `<span>• ${genres}</span>` : ''}
                       </p>
                       <p class="text-sm sm:text-base text-gray-300 leading-[1.6] line-clamp-3 sm:line-clamp-4">${description}</p>
                       <div class="flex items-center gap-3 pt-2">
                           <button onclick="openAnimeModal(${anime.id})"
                                   class="flex items-center gap-2 bg-crunchy hover:bg-crunchy-light text-black font-black uppercase tracking-wide text-xs sm:text-sm px-4 sm:px-5 h-12 transition-colors">
                               <i class="fa-regular fa-circle-play text-lg"></i> ${buttonLabel}
                           </button>
                           ${createWatchlistButton(anime.id, 'icon',
                               'w-12 h-12 shrink-0 border-2 border-crunchy text-crunchy hover:bg-crunchy/15 flex items-center justify-center text-lg transition-colors')}
                       </div>
                   </div>
               </div>
           </div>
       `;
   }
   
   
   /* ==========================================================================
      7. PAGES: home, browse / category / search, release calendar
      ========================================================================== */
   
   /** Home page: hero carousel + rows of anime. */
   function showHome({ keepScroll = false } = {}) {
       const container = document.getElementById('content-container');
       if (!container) return;
   
       currentView = 'home';
       renderedHistoryVersion = historyVersion;
       browseState.token++;   // cancel any page that is still loading
       resetSearchUi();
       closeAllMenus();
   
       showHero();
       renderHero();
   
       const { season, year } = getCurrentSeason();
       container.innerHTML = [
           createContinueRow(),
           createAnimeRow('Most Popular', homeData.popular, 'popular'),
           createAnimeRow('Trending Now', homeData.trending, 'trending'),
           createAnimeRow('New Anime from the Current Season', homeData.season, 'season'),
           createAnimeRow('Top Rated', homeData.topRated, 'topRated')
       ].join('');
   
       if (!keepScroll) window.scrollTo({ top: 0 });
   }
   
   /** Filters used by the menu pages (New, Popular, Simulcast, ...). */
   function getBrowsePreset(key) {
       const { season, year } = getCurrentSeason();
   
       const presets = {
           new:       { title: 'New Releases',   filters: { status: 'RELEASING', sort: ['START_DATE_DESC'] } },
           popular:   { title: 'Most Popular',   filters: { sort: ['POPULARITY_DESC'] } },
           trending:  { title: 'Trending Now',   filters: { sort: ['TRENDING_DESC'] } },
           topRated:  { title: 'Top Rated',      filters: { sort: ['SCORE_DESC'] } },
           simulcast: { title: 'Simulcast - Airing Now', filters: { status: 'RELEASING', sort: ['POPULARITY_DESC'] } },
           season:    { title: `${capitalize(season)} ${year} Season`, filters: { season, seasonYear: year, sort: ['POPULARITY_DESC'] } },
           all:       { title: 'Browse All (A-Z)', filters: { sort: ['TITLE_ROMAJI'] } },
           music:     { title: 'Music Videos & Concerts', filters: { format: 'MUSIC', sort: ['POPULARITY_DESC'] } }
       };
       return presets[key];
   }
   
   /** Opens a menu page: 'new', 'popular', 'simulcast', 'all', 'music', 'calendar', ... */
   function openNav(key) {
       closeAllMenus();
   
       if (key === 'calendar') {
           openBrowse({ title: 'Release Calendar', subtitle: 'Episodes airing in the next 7 days', loader: fetchCalendarPage, showChips: false });
           return;
       }
   
       if (key === 'history') {
           openBrowse({
               title: 'Watch History',
               showChips: false,
               emptyMessage: 'Nothing here yet. Open an anime and it will show up here.',
               loader: async () => ({ items: watchHistory.map(entry => entry.anime), hasNext: false })
           });
           return;
       }
   
       const preset = getBrowsePreset(key);
       if (!preset) return;
   
       openBrowse({ title: preset.title, loader: page => fetchBrowsePage(preset.filters, page) });
   }
   
   /** Opens a genre page from the Categories menu (e.g. 'Action'). */
   function openGenre(label) {
       const genre = GENRES.find(item => item.label === label);
       if (!genre) return;
   
       const filters = { sort: ['POPULARITY_DESC'] };
       if (genre.genre) filters.genre_in = [genre.genre];
       if (genre.tag) filters.tag_in = [genre.tag];
   
       openBrowse({
           title: genre.label,
           activeGenre: genre.label,
           emptyMessage: `No anime found for ${genre.label}.`,
           loader: page => fetchBrowsePage(filters, page)
       });
   }
   
   /** Row of genre buttons shown at the top of category pages. */
   function createGenreChips(activeGenre) {
       const chips = GENRES.map(genre => {
           const stateClasses = genre.label === activeGenre
               ? 'bg-crunchy border-crunchy text-black'
               : 'border-white/25 text-gray-300 hover:border-white hover:text-white';
           return `<button onclick="openGenre('${genre.label}')" class="shrink-0 px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${stateClasses}">${genre.label}</button>`;
       }).join('');
   
       return `<div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">${chips}</div>`;
   }
   
   /**
    * Shows a page of results (category, menu page, search, calendar...).
    * `loader(page)` must return Promise<{ items, hasNext }>.
    * Pages after the first load when the "Load more" button is pressed.
    */
   function openBrowse({ title, subtitle = '', loader, activeGenre = null, showChips = true, isSearch = false, emptyMessage = 'No anime found.' }) {
       const container = document.getElementById('content-container');
       if (!container) return;
   
       currentView = 'browse';
       hideHero();
       closeAllMenus();
       if (!isSearch) resetSearchUi();
   
       browseState.token++;
       Object.assign(browseState, {
           loader, page: 0, hasNext: false, loading: false, count: 0,
           seen: new Set(), activeGenre, isSearch, emptyMessage
       });
   
       container.innerHTML = `
           <section class="space-y-5">
               <div class="flex items-start justify-between gap-3">
                   <div>
                       <h1 class="text-2xl sm:text-3xl font-bold">${title}</h1>
                       ${subtitle ? `<p class="mt-1 text-sm text-gray-400">${subtitle}</p>` : ''}
                   </div>
                   <button onclick="showHome()" class="shrink-0 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white">
                       <i class="fa-solid fa-arrow-left mr-1"></i> Home
                   </button>
               </div>
               ${showChips ? createGenreChips(activeGenre) : ''}
               <div id="browse-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 sm:gap-x-4 gap-y-6"></div>
               <div id="browse-footer" class="py-6 text-center"></div>
           </section>
       `;
   
       window.scrollTo({ top: 0 });
       loadNextBrowsePage();
   }
   
   /** Loads the next page of the current browse page and adds it to the grid. */
   async function loadNextBrowsePage() {
       if (browseState.loading) return;
   
       const token = browseState.token;
       browseState.loading = true;
       setBrowseFooter('loading');
   
       try {
           const { items, hasNext } = await browseState.loader(browseState.page + 1);
           if (token !== browseState.token) return;   // the person went somewhere else
   
           browseState.page += 1;
           browseState.hasNext = hasNext;
           appendBrowseItems(items);
       } catch (err) {
           if (token !== browseState.token) return;
   
           console.warn('Could not load anime from AniList', err);
           browseState.loading = false;
           setBrowseFooter('error');
           return;
       }
   
       browseState.loading = false;
       if (browseState.hasNext) setBrowseFooter('more');
       else setBrowseFooter(browseState.count === 0 ? 'empty' : 'end');
   }
   
   /** Adds cards to the grid (skipping anime that are already shown). */
   function appendBrowseItems(items) {
       const grid = document.getElementById('browse-grid');
       if (!grid) return;
   
       const newItems = items.filter(anime => {
           const key = anime._airing ? `${anime.id}-${anime._airing.episode}` : anime.id;
           if (browseState.seen.has(key)) return false;
           browseState.seen.add(key);
           return true;
       });
   
       browseState.count += newItems.length;
       grid.insertAdjacentHTML('beforeend', newItems.map(anime => createAnimeCard(anime, { fluid: true })).join(''));
   }
   
   /** Content under the grid: spinner, "Load more", error message, etc. */
   function setBrowseFooter(state) {
       const footer = document.getElementById('browse-footer');
       if (!footer) return;
   
       const buttonClasses = 'px-6 py-3 border-2 border-crunchy text-crunchy hover:bg-crunchy/15 font-black uppercase tracking-wide text-sm transition-colors';
   
       if (state === 'loading') {
           footer.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-2xl text-crunchy"></i>`;
       } else if (state === 'more') {
           footer.innerHTML = `<button onclick="loadNextBrowsePage()" class="${buttonClasses}">Load more</button>`;
       } else if (state === 'error') {
           footer.innerHTML = `
               <p class="text-gray-400 mb-4">Couldn't reach AniList. Check your connection and try again.</p>
               <button onclick="loadNextBrowsePage()" class="${buttonClasses}">Retry</button>
           `;
       } else if (state === 'empty') {
           footer.innerHTML = `<p class="text-gray-400 py-10">${browseState.emptyMessage}</p>`;
       } else {
           footer.innerHTML = '';
       }
   }
   
   
   /* ==========================================================================
      8. HERO CAROUSEL
      ========================================================================== */
   
   /** The anime shown in the hero (trending ones that have a banner image). */
   function getHeroItems() {
       const withBanner = homeData.trending.filter(anime => anime.bannerImage);
       const pool = withBanner.length >= 3 ? withBanner : homeData.trending;
       return pool.slice(0, 6);
   }
   
   function renderHero() {
       const hero = document.getElementById('hero-section');
       if (!hero) return;
   
       heroState.items = getHeroItems();
       heroState.index = 0;
   
       if (heroState.items.length === 0) {
           hero.innerHTML = '';
           return;
       }
   
       hero.innerHTML = `
           ${heroState.items.map(createHeroSlide).join('')}
           <button onclick="prevHero()" aria-label="Previous" class="hidden md:flex absolute left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center text-2xl text-white/80 hover:text-white">
               <i class="fa-solid fa-chevron-left"></i>
           </button>
           <button onclick="nextHero()" aria-label="Next" class="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center text-2xl text-white/80 hover:text-white">
               <i class="fa-solid fa-chevron-right"></i>
           </button>
           <div id="hero-dashes" class="absolute left-0 bottom-36 sm:bottom-44 z-20 flex items-center gap-2 ${PAGE_PADDING_X}"></div>
       `;
   
       renderHeroDashes();
       startHeroTimer();
   }
   
   /** The little bars at the bottom-left (the active one fills up as a timer). */
   function renderHeroDashes() {
       const dashes = document.getElementById('hero-dashes');
       if (!dashes) return;
   
       dashes.innerHTML = heroState.items.map((anime, index) => `
           <button class="hero-dash ${index === heroState.index ? 'is-active' : ''}" onclick="setHeroSlide(${index})" aria-label="Show slide ${index + 1}"></button>
       `).join('');
   }
   
   function setHeroSlide(index) {
       const count = heroState.items.length;
       if (count === 0) return;
   
       heroState.index = (index + count) % count;
       document.querySelectorAll('.hero-slide').forEach((slide, slideIndex) => {
           slide.classList.toggle('is-active', slideIndex === heroState.index);
       });
   
       renderHeroDashes();
       startHeroTimer();
   }
   
   function nextHero() { setHeroSlide(heroState.index + 1); }
   function prevHero() { setHeroSlide(heroState.index - 1); }
   
   function startHeroTimer() {
       stopHeroTimer();
       if (heroState.items.length > 1) {
           heroState.timer = setInterval(nextHero, HERO_INTERVAL_MS);
       }
   }
   
   function stopHeroTimer() {
       clearInterval(heroState.timer);
       heroState.timer = null;
   }
   
   function showHero() {
       const hero = document.getElementById('hero-section');
       if (hero) hero.style.display = 'block';
       const c = document.getElementById('content-container');
       if (c) c.classList.add('hero-overlap');
   }
   
   function hideHero() {
       const hero = document.getElementById('hero-section');
       if (hero) hero.style.display = 'none';
       const c = document.getElementById('content-container');
       if (c) c.classList.remove('hero-overlap');
       stopHeroTimer();
   }
   
   /** Swipe left / right on the hero to change slides (phones and tablets). */
   function initHeroSwipe() {
       const hero = document.getElementById('hero-section');
       if (!hero) return;
   
       let startX = null;
       hero.addEventListener('touchstart', event => { startX = event.touches[0].clientX; }, { passive: true });
       hero.addEventListener('touchend', event => {
           if (startX === null) return;
           const distance = event.changedTouches[0].clientX - startX;
           startX = null;
           if (Math.abs(distance) > 50) (distance < 0 ? nextHero : prevHero)();
       });
   }
   
   
   /* ==========================================================================
      9. HEADER: search and menus
      ========================================================================== */
   
   /* ---------- Live search ---------- */
   
   function toggleSearchBar() {
       const bar = document.getElementById('search-bar');
       if (!bar) return;
   
       if (bar.classList.contains('hidden')) {
           bar.classList.remove('hidden');
           closeAllMenus();
           document.getElementById('search-input').focus();
       } else {
           closeSearchBar();
       }
   }
   
   /** Closes the search bar; if search results are showing, goes back to the home page. */
   function closeSearchBar() {
       const wasSearching = currentView === 'browse' && browseState.isSearch;
       resetSearchUi();
       if (wasSearching) showHome();
   }
   
   /** Hides the search bar and clears what was typed (does not change the page). */
   function resetSearchUi() {
       clearTimeout(searchDebounceTimer);
       lastSearchQuery = '';
   
       const bar = document.getElementById('search-bar');
       const input = document.getElementById('search-input');
       if (bar) bar.classList.add('hidden');
       if (input) input.value = '';
   }
   
   /** Called on every keystroke: waits until the person pauses, then searches. */
   function handleSearchInput(value) {
       clearTimeout(searchDebounceTimer);
       const query = value.trim();
   
       // Search box emptied: go back to the home page
       if (query.length === 0) {
           lastSearchQuery = '';
           if (currentView === 'browse' && browseState.isSearch) showHome();
           return;
       }
   
       if (query.length < 2) return;
       searchDebounceTimer = setTimeout(() => runSearch(query), 350);
   }
   
   function handleSearchKeydown(event) {
       if (event.key === 'Enter') {
           clearTimeout(searchDebounceTimer);
           const query = event.target.value.trim();
           if (query) runSearch(query);
       } else if (event.key === 'Escape') {
           closeSearchBar();
       }
   }
   
   /** Searches ALL of AniList (every season, OVA, movie...) and shows the results. */
   function runSearch(query) {
       if (query === lastSearchQuery && currentView === 'browse' && browseState.isSearch) return;
       lastSearchQuery = query;
   
       const safeQuery = escapeHtml(query);
   
       openBrowse({
           title: `Results for "${safeQuery}"`,
           isSearch: true,
           showChips: false,
           emptyMessage: `No anime found for "${safeQuery}".`,
           loader: async page => {
               try {
                   return await fetchBrowsePage({ search: query, sort: ['SEARCH_MATCH'] }, page);
               } catch (err) {
                   // AniList unreachable: search only the anime we already have
                   if (page > 1) throw err;
                   const lowerQuery = query.toLowerCase();
                   const items = Array.from(animeIndex.values()).filter(anime =>
                       getTitle(anime).toLowerCase().includes(lowerQuery) ||
                       (anime.title.romaji || '').toLowerCase().includes(lowerQuery)
                   );
                   return { items, hasNext: false };
               }
           }
       });
   }
   
   /* ---------- Menus ---------- */
   
   /** Fills the genre lists in the Categories menu (desktop) and the mobile menu. */
   function renderGenreMenus() {
       const genreButtons = GENRES.map(genre =>
           `<button class="genre-link" onclick="openGenre('${genre.label}')">${genre.label}</button>`
       ).join('');
   
       const desktop = document.getElementById('genre-grid-desktop');
       const mobile = document.getElementById('genre-grid-mobile');
       if (desktop) desktop.innerHTML = genreButtons;
       if (mobile) mobile.innerHTML = genreButtons;
   }
   
   function openCategoriesMenu() {
       clearTimeout(categoriesCloseTimer);
       const menu = document.getElementById('categories-menu');
       const button = document.getElementById('categories-btn');
       if (menu) menu.classList.remove('hidden');
       if (button) button.setAttribute('aria-expanded', 'true');
       const bd = document.getElementById('menu-backdrop');
       if (bd) bd.classList.add('is-open');
   }
   
   function closeCategoriesMenu() {
       clearTimeout(categoriesCloseTimer);
       const menu = document.getElementById('categories-menu');
       const button = document.getElementById('categories-btn');
       if (menu) menu.classList.add('hidden');
       if (button) button.setAttribute('aria-expanded', 'false');
       const bd = document.getElementById('menu-backdrop');
       if (bd) bd.classList.remove('is-open');
   }
   
   /** Closes the Categories menu shortly after the mouse leaves it. */
   function scheduleCloseCategoriesMenu() {
       clearTimeout(categoriesCloseTimer);
       categoriesCloseTimer = setTimeout(closeCategoriesMenu, 150);
   }
   
   function toggleMobileMenu() {
       const menu = document.getElementById('mobile-menu');
       const button = document.getElementById('mobile-menu-btn');
       if (!menu || !button) return;
   
       const isOpening = menu.classList.contains('hidden');
       menu.classList.toggle('hidden', !isOpening);
       button.innerHTML = `<i class="fa-solid ${isOpening ? 'fa-xmark' : 'fa-bars'}"></i>`;
   }
   
   function closeMobileMenu() {
       const menu = document.getElementById('mobile-menu');
       const button = document.getElementById('mobile-menu-btn');
       if (menu) menu.classList.add('hidden');
       if (button) button.innerHTML = '<i class="fa-solid fa-bars"></i>';
   }
   
   function closeAllMenus() {
       closeCategoriesMenu();
       closeMobileMenu();
   }
   
   
   /* ==========================================================================
      10. ANIME PAGE / VIDEO PLAYER
      ========================================================================== */
   
   // Used to refresh "Continue Watching" on the home page after watching something
   let historyVersion = 0;
   let renderedHistoryVersion = 0;
   
   /** Saves what the person is watching right now. */
   function recordHistory() {
       const anime = findAnimeById(currentModalState.animeId);
       if (!anime) return;
   
       saveHistory(anime, currentModalState.selectedEpisode, currentModalState.audioType);
       historyVersion++;
   }
   
   /** Opens the anime page, resuming from the last episode watched (or episode 1). */
   function openAnimeModal(animeId) {
       const anime = findAnimeById(animeId);
       if (!anime) return;
   
       const saved = findHistory(animeId);
       currentModalState.animeId = anime.id;
       currentModalState.selectedEpisode = saved ? saved.episode : 1;
       currentModalState.audioType = saved ? saved.audio : 'sub';
   
       renderModalContent(anime);
   
       const modal = document.getElementById('anime-modal');
       if (modal) {
           modal.classList.remove('hidden');
           modal.classList.add('flex');
           modal.scrollTop = 0;
       }
       document.body.style.overflow = 'hidden';   // stop the page behind from scrolling
   
       // Only count it as "watching" after 10 seconds, so quick peeks don't fill the history
       clearTimeout(historyTimer);
       historyTimer = setTimeout(recordHistory, 10000);
   }
   
   /** Closes the anime page and clears its content (this also stops the video). */
   function closeModal() {
       const modal = document.getElementById('anime-modal');
       if (!modal || modal.classList.contains('hidden')) return;
   
       modal.classList.add('hidden');
       modal.classList.remove('flex');
   
       const modalContent = document.getElementById('modal-content');
       if (modalContent) modalContent.innerHTML = '';
   
       clearTimeout(historyTimer);
       document.body.style.overflow = '';   // allow the page to scroll again
   
       // Update "Continue Watching" if the person watched something
       if (currentView === 'home' && historyVersion !== renderedHistoryVersion) {
           showHome({ keepScroll: true });
       }
   }
   
   /** Switches the episode and re-renders the page. */
   function changeEpisode(episodeNumber) {
       const anime = findAnimeById(currentModalState.animeId);
       if (!anime || episodeNumber < 1 || episodeNumber > getEpisodeCount(anime)) return;
   
       currentModalState.selectedEpisode = episodeNumber;
       clearTimeout(historyTimer);
       recordHistory();
       refreshModal();
   }
   
   /** Switches between SUB and DUB and re-renders the page. */
   function setAudioType(type) {
       currentModalState.audioType = type;
       clearTimeout(historyTimer);
       recordHistory();
       refreshModal();
   }
   
   /** Re-renders the page for whichever anime is currently open. */
   function refreshModal() {
       const anime = findAnimeById(currentModalState.animeId);
       if (anime) renderModalContent(anime);
   }
   
   /** Total number of episodes to list (unknown counts default to 12). */
   function getEpisodeCount(anime) {
       return anime.episodes || 12;
   }
   
   /** One row of the playlist: number, thumbnail, episode title, anime name. */
   function createPlaylistItem(anime, episodeNumber) {
       const title = getTitle(anime);
       const isActive = episodeNumber === currentModalState.selectedEpisode;
       const audioLabel = currentModalState.audioType.toUpperCase();
   
       return `
           <button onclick="changeEpisode(${episodeNumber})" ${isActive ? 'id="active-episode"' : ''}
                   class="flex items-start gap-2 w-full text-left p-2 rounded-lg transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}">
               <span class="w-5 shrink-0 self-center text-center text-xs text-gray-400">
                   ${isActive ? '<i class="fa-solid fa-play text-[10px] text-white"></i>' : episodeNumber}
               </span>
               <div class="relative w-28 shrink-0 aspect-video rounded-md overflow-hidden bg-[#1a1a1a]">
                   <img src="${getWideImage(anime)}" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null; this.src='${getFallbackPosterUrl(title)}';">
                   <span class="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-semibold px-1 py-0.5 rounded">${audioLabel}</span>
               </div>
               <div class="min-w-0 flex-1 py-0.5">
                   <p class="text-sm font-semibold text-white line-clamp-2">Episode ${episodeNumber}</p>
                   <p class="text-xs text-gray-400 mt-1 line-clamp-1">${escapeHtml(title)}</p>
               </div>
           </button>
       `;
   }
   
   /**
    * YouTube-style playlist panel: header with title, "N / total" counter and
    * previous / next buttons, followed by a scrollable list of episodes.
    */
   function createEpisodePlaylist(anime) {
       const title = getTitle(anime);
       const total = getEpisodeCount(anime);
       const current = currentModalState.selectedEpisode;
       const navButtonClasses = 'w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors';
   
       let itemsHtml = '';
       for (let ep = 1; ep <= total; ep++) {
           itemsHtml += createPlaylistItem(anime, ep);
       }
   
       return `
           <div class="flex flex-col bg-[#141414] border border-white/10 rounded-xl overflow-hidden lg:absolute lg:inset-0">
               <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
                   <div class="min-w-0">
                       <h3 class="font-bold text-base text-white">Episodes</h3>
                       <p class="text-xs text-gray-400 truncate">${escapeHtml(title)} - ${current} / ${total}</p>
                   </div>
                   <div class="flex items-center gap-1 shrink-0">
                       <button onclick="changeEpisode(${current - 1})" ${current <= 1 ? 'disabled' : ''} title="Previous episode"
                               class="${navButtonClasses} ${current <= 1 ? 'text-gray-600 cursor-not-allowed' : 'text-white hover:bg-white/10'}">
                           <i class="fa-solid fa-backward-step"></i>
                       </button>
                       <button onclick="changeEpisode(${current + 1})" ${current >= total ? 'disabled' : ''} title="Next episode"
                               class="${navButtonClasses} ${current >= total ? 'text-gray-600 cursor-not-allowed' : 'text-white hover:bg-white/10'}">
                           <i class="fa-solid fa-forward-step"></i>
                       </button>
                   </div>
               </div>
               <div id="episode-list" class="relative flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5 max-h-96 lg:max-h-none">
                   ${itemsHtml}
               </div>
           </div>
       `;
   }
   
   /** Scrolls the playlist so the current episode is centered (like YouTube). */
   function scrollPlaylistToActiveEpisode() {
       const list = document.getElementById('episode-list');
       const active = document.getElementById('active-episode');
       if (!list || !active) return;
   
       list.scrollTop = active.offsetTop - (list.clientHeight - active.clientHeight) / 2;
   }
   
   /** One SUB / DUB toggle button. */
   function createAudioButton(type) {
       const isActive = currentModalState.audioType === type;
       const stateClasses = isActive
           ? 'bg-crunchy text-black'
           : 'bg-[#232323] text-gray-400 hover:text-white';
   
       return `
           <button onclick="setAudioType('${type}')" class="px-3 py-1 rounded text-xs font-bold transition-all ${stateClasses}">${type.toUpperCase()}</button>
       `;
   }
   
   /** Builds the full anime page: player, playlist, details, synopsis. */
   function renderModalContent(anime) {
       const modalContent = document.getElementById('modal-content');
       if (!modalContent) return;
   
       const title = escapeHtml(getTitle(anime));
       const score = getScore(anime);
       const synopsis = anime.description ? stripHtml(anime.description) : 'No synopsis available.';
       const genres = anime.genres ? anime.genres.join(', ') : '';
       const { selectedEpisode, audioType } = currentModalState;
       const playerUrl = getAnimeStreamUrl(anime.id, selectedEpisode, audioType);
   
       modalContent.innerHTML = `
           <div class="space-y-6">
   
               <!-- Player (left) + episode playlist (right on large screens) -->
               <div class="flex flex-col lg:flex-row gap-4">
   
                   <!-- Left column: video player and controls -->
                   <div class="flex-1 min-w-0 space-y-3">
                       <div class="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-lg border border-white/10">
                           <iframe id="stream-iframe" class="w-full h-full" src="${playerUrl}" title="${title} Episode ${selectedEpisode}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen onerror="this.style.display='none'; document.getElementById('iframe-fallback').style.display='flex';"></iframe>
                           <div id="iframe-fallback" class="absolute inset-0 bg-[#141414] flex-col items-center justify-center p-6 text-center" style="display: none;">
                               <div class="w-16 h-16 bg-crunchy text-black rounded-full flex items-center justify-center mx-auto text-xl shadow-lg mb-3">
                                   <i class="fa-solid fa-play"></i>
                               </div>
                               <h4 class="font-bold text-base text-white">Streaming URL Ready</h4>
                               <p class="text-xs text-gray-400 mt-1 break-all">Target URL: <code class="text-crunchy">${playerUrl}</code></p>
                           </div>
                       </div>
   
                       <!-- Controls bar: audio type & current episode -->
                       <div class="flex flex-wrap items-center justify-between gap-3 bg-[#141414] p-3 rounded-lg border border-white/10">
                           <div class="flex items-center space-x-2">
                               <span class="text-xs font-bold text-gray-400 uppercase">Audio:</span>
                               ${createAudioButton('sub')}
                               ${createAudioButton('dub')}
                           </div>
                           <div class="text-xs text-gray-400">
                               Playing <span class="text-white font-bold">Episode ${selectedEpisode}</span> (${audioType.toUpperCase()})
                           </div>
                       </div>
                   </div>
   
                   <!-- Right column: YouTube-style episode playlist -->
                   <aside class="lg:w-80 xl:w-[26rem] shrink-0 relative">
                       ${createEpisodePlaylist(anime)}
                   </aside>
               </div>
   
               <!-- Anime details header -->
               <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                   <div>
                       <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold mb-2">
                           <span class="bg-crunchy text-black px-2 py-0.5 rounded">${anime.status || 'AIRING'}</span>
                           <span class="text-yellow-400 flex items-center gap-1"><i class="fa-solid fa-star"></i> ${score}</span>
                           <span class="text-gray-300">${anime.seasonYear || ''}</span>
                           <span class="text-crunchy">${anime.episodes ? anime.episodes + ' Episodes' : ''}</span>
                       </div>
                       <h2 class="text-2xl sm:text-3xl font-black text-white">${title}</h2>
                       <p class="text-xs text-crunchy mt-1 font-semibold">${genres}</p>
                   </div>
                   <div class="flex items-center space-x-3">
                       ${createWatchlistButton(anime.id, 'full',
                           'flex items-center gap-2 border-2 border-crunchy text-crunchy hover:bg-crunchy/15 font-bold px-4 h-10 transition-colors text-xs uppercase tracking-wide')}
                   </div>
               </div>
   
               <!-- Synopsis -->
               <div class="space-y-3">
                   <h4 class="font-bold text-sm text-gray-300 uppercase tracking-wider">Synopsis</h4>
                   <p class="text-sm text-gray-300 leading-relaxed">${synopsis}</p>
               </div>
           </div>
       `;
   
       scrollPlaylistToActiveEpisode();
   }
   
   
   /* ==========================================================================
      11. WATCHLIST POPUP
      ========================================================================== */
   
   /** One row in the watchlist popup. */
   function createWatchlistItem(anime) {
       const title = escapeHtml(getTitle(anime));
   
       return `
           <div class="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/10 hover:border-crunchy transition-colors">
               <div class="flex items-center gap-4 min-w-0 cursor-pointer" onclick="closeWatchlistModal(); openAnimeModal(${anime.id});">
                   <img src="${getCover(anime)}" alt="" class="w-12 h-16 object-cover rounded shadow shrink-0" onerror="this.onerror=null; this.src='${getFallbackPosterUrl(getTitle(anime))}';">
                   <div class="min-w-0">
                       <h4 class="font-bold text-sm text-white line-clamp-1 hover:text-crunchy transition-colors">${title}</h4>
                       <div class="flex items-center gap-3 text-xs text-gray-400 mt-1">
                           <span class="text-yellow-400"><i class="fa-solid fa-star"></i> ${getScore(anime)}</span>
                           <span>${anime.seasonYear || ''}</span>
                           <span class="text-crunchy">${anime.genres ? anime.genres[0] : ''}</span>
                       </div>
                   </div>
               </div>
               <button onclick="toggleWatchlist(${anime.id}); openWatchlistModal();" aria-label="Remove from watchlist" class="text-gray-400 hover:text-red-500 p-2 transition-colors">
                   <i class="fa-solid fa-trash-can"></i>
               </button>
           </div>
       `;
   }
   
   /** Opens the watchlist popup and lists every saved anime. */
   function openWatchlistModal() {
       const modal = document.getElementById('watchlist-modal');
       const container = document.getElementById('watchlist-items-container');
       if (!modal || !container) return;
   
       if (watchlist.length === 0) {
           container.innerHTML = `
               <div class="text-center py-12 text-gray-400">
                   <i class="fa-regular fa-bookmark text-3xl mb-3 text-gray-600"></i>
                   <p class="font-bold text-base">Your watchlist is empty.</p>
                   <p class="text-xs text-gray-500 mt-1">Tap the bookmark on any anime to save it here.</p>
               </div>
           `;
       } else {
           container.innerHTML = watchlist.map(createWatchlistItem).join('');
       }
   
       modal.classList.remove('hidden');
       modal.classList.add('flex');
   }
   
   function closeWatchlistModal() {
       const modal = document.getElementById('watchlist-modal');
       if (modal) {
           modal.classList.add('hidden');
           modal.classList.remove('flex');
       }
   }
   
   
   /* ==========================================================================
      12. APP START
      ========================================================================== */
   
   // Click anywhere outside the Categories menu to close it
   document.addEventListener('click', event => {
       const wrap = document.getElementById('categories-wrap');
       if (wrap && !wrap.contains(event.target)) closeCategoriesMenu();
   });
   
   // Press Escape to close the anime page, the watchlist popup and the menus
   document.addEventListener('keydown', event => {
       if (event.key !== 'Escape') return;
       closeModal();
       closeWatchlistModal();
       closeAllMenus();
   });
   
   document.addEventListener('DOMContentLoaded', () => {
       renderGenreMenus();
       initHeroSwipe();
       updateWatchlistCount();
       loadHome();
   });