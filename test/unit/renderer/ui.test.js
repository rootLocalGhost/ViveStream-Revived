/**
 * @jest-environment jsdom
 */

// 1. Setup Globals BEFORE requiring the module
// This prevents ReferenceError: IntersectionObserver is not defined in ui.js top-level code.
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};

// Mock window globals
global.window.electronAPI = {
  getPlatform: jest.fn().mockReturnValue('linux'),
};

// Mock document body structure required by ui.js top-level selectors
document.body.innerHTML = `
  <input id="home-search-input" />
  <div class="search-container"></div>
  <div id="video-item-context-menu"></div>
  <div id="context-remove-from-playlist-btn"></div>
  <div id="home-page"></div>
  <div id="favorites-page"></div>
  <template id="video-grid-item-template">
    <div class="video-grid-item">
        <img class="grid-thumbnail" />
        <div class="thumbnail-overlay-icon"></div>
        <span class="thumbnail-duration"></span>
        <p class="grid-item-title"></p>
        <p class="grid-item-meta"></p>
        <button class="favorite-btn"><span></span></button>
    </div>
  </template>
  <div class="sidebar"></div>
  <div id="search-page"></div>
  <div id="scroll-sentinel"></div>
  <div id="fps-counter" class="hidden"></div>
  <div class="content-wrapper"></div>
  <div id="header-actions-container"></div>
  <div id="sort-dropdown">
      <span id="sort-dropdown-label"></span>
  </div>
`;

// 2. Mock dependencies
jest.mock('../../../src/renderer/js/state.js', () => ({
  AppState: {
    library: [],
    currentFilters: {
      type: 'all',
      duration: 'all',
      source: 'all',
      uploadDate: 'all',
    },
    assetsPath: '/path/to/assets',
  },
  setFilters: jest.fn(),
}));

jest.mock('../../../src/renderer/js/renderer.js', () => ({
  showPage: jest.fn(),
  handleNav: jest.fn(),
  showLoader: jest.fn(),
  hideLoader: jest.fn(),
  renderSearchPage: jest.fn(),
}));

jest.mock('../../../src/renderer/js/playlists.js', () => ({
  openAddToPlaylistModal: jest.fn(),
  renderPlaylistCard: jest.fn(),
}));

jest.mock('../../../src/renderer/js/player.js', () => ({
  renderUpNextList: jest.fn(),
}));

jest.mock('../../../src/renderer/js/artists.js', () => ({
  renderArtistCard: jest.fn(),
}));

jest.mock('../../../src/renderer/js/utils.js', () => ({
  formatTime: jest.fn((s) => `${s}s`),
  debounce: (fn) => fn,
  fuzzySearch: jest.fn(),
}));

jest.mock('../../../src/renderer/js/event-bus.js', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn() },
}));

jest.mock('../../../src/renderer/js/modals.js', () => ({
  showConfirmationModal: jest.fn(),
}));

jest.mock('../../../src/renderer/js/notifications.js', () => ({
  showNotification: jest.fn(),
}));

jest.mock('../../../src/renderer/js/miniplayer.js', () => ({
  activateMiniplayer: jest.fn(),
  deactivateMiniplayer: jest.fn(),
  closeMiniplayer: jest.fn(),
  initializeMiniplayer: jest.fn(),
}));

jest.mock('../../../src/renderer/js/settings.js', () => ({
  initializeSettingsPage: jest.fn(),
  loadSettings: jest.fn(),
}));

// 3. Import Module Under Test (using require to ensure mocks run first)
const {
  applyFilters,
  createGridItem,
  sortLibrary,
  updateSearchPlaceholder,
  toggleFPSCounter,
  setWindowControlsAlignment,
  renderHomePageGrid,
  renderFavoritesPage,
} = require('../../../src/renderer/js/ui.js');
const { AppState } = require('../../../src/renderer/js/state.js');

describe('UI Logic - renderFavoritesPage', () => {
  const favoritesPage = document.getElementById('favorites-page');

  beforeEach(() => {
    favoritesPage.innerHTML = '';
    AppState.library = [];
  });

  it('should render empty favorites placeholder', () => {
    renderFavoritesPage();
    expect(favoritesPage.querySelector('.placeholder-page')).not.toBeNull();
    expect(favoritesPage.querySelector('.placeholder-title').textContent).toBe(
      'No Favorites Yet'
    );
  });

  it('should render the video grid if favorites exist', () => {
    AppState.library = [
      { id: '1', title: 'Test', isFavorite: true },
      { id: '2', title: 'Test 2', isFavorite: false },
    ];
    renderFavoritesPage();
    expect(favoritesPage.querySelector('.video-grid')).not.toBeNull();
    expect(favoritesPage.querySelector('.placeholder-page')).toBeNull();
  });
});

describe('UI Logic - renderHomePageGrid', () => {
  const homePage = document.getElementById('home-page');

  beforeEach(() => {
    homePage.innerHTML = '';
    AppState.library = [];
  });

  it('should render empty library placeholder', () => {
    renderHomePageGrid();
    expect(homePage.querySelector('.placeholder-page')).not.toBeNull();
    expect(homePage.querySelector('.placeholder-title').textContent).toBe(
      'Your Library is Empty'
    );
  });

  it('should render the video grid if library is not empty', () => {
    AppState.library = [{ id: '1', title: 'Test' }];
    renderHomePageGrid();
    expect(homePage.querySelector('.video-grid')).not.toBeNull();
    expect(homePage.querySelector('.placeholder-page')).toBeNull();
  });
});

describe('UI Logic - Window and FPS', () => {
  const fpsCounter = document.getElementById('fps-counter');

  it('toggleFPSCounter should show/hide the counter', () => {
    toggleFPSCounter(true);
    expect(fpsCounter.classList.contains('hidden')).toBe(false);
    toggleFPSCounter(false);
    expect(fpsCounter.classList.contains('hidden')).toBe(true);
  });

  it('setWindowControlsAlignment should set correct body class', () => {
    setWindowControlsAlignment('win');
    expect(document.body.classList.contains('platform-win')).toBe(true);
    expect(document.body.classList.contains('platform-mac')).toBe(false);

    setWindowControlsAlignment('mac');
    expect(document.body.classList.contains('platform-win')).toBe(false);
    expect(document.body.classList.contains('platform-mac')).toBe(true);
  });
});

describe('UI Logic - updateSearchPlaceholder', () => {
  const searchInput = document.getElementById('home-search-input');
  const searchContainer = document.querySelector('.search-container');

  beforeEach(() => {
    searchInput.placeholder = '';
    searchInput.disabled = false;
    searchContainer.classList.remove('hidden');
  });

  it('should show and enable search for home page', () => {
    updateSearchPlaceholder('home');
    expect(searchContainer.classList.contains('hidden')).toBe(false);
    expect(searchInput.disabled).toBe(false);
    expect(searchInput.placeholder).toBe(
      'Search videos, artists, playlists...'
    );
  });

  it('should hide and disable search for settings page', () => {
    updateSearchPlaceholder('settings');
    expect(searchContainer.classList.contains('hidden')).toBe(true);
    expect(searchInput.disabled).toBe(true);
  });

  it('should hide and disable search for downloads page', () => {
    updateSearchPlaceholder('downloads');
    expect(searchContainer.classList.contains('hidden')).toBe(true);
    expect(searchInput.disabled).toBe(true);
  });
});

describe('UI Logic - createGridItem', () => {
  const mockVideo = {
    id: 'vid1',
    type: 'video',
    coverPath: 'file:///path/to/cover.jpg',
    duration: 300,
    title: 'Test Video',
    creator: 'Test Creator',
    isFavorite: false,
  };

  it('should create a standard video item', () => {
    const item = createGridItem(mockVideo);
    const thumbnail = item.querySelector('.grid-thumbnail');

    expect(item.dataset.id).toBe('vid1');
    expect(thumbnail.dataset.src).toBe('file:///path/to/cover.jpg');
    expect(thumbnail.src).toContain('/path/to/assets/logo.png'); // Placeholder
    expect(item.querySelector('.grid-item-title').textContent).toBe(
      'Test Video'
    );
    expect(item.querySelector('.grid-item-meta').textContent).toBe(
      'Test Creator'
    );
    expect(item.querySelector('.thumbnail-duration').textContent).toBe('300s');
    expect(item.querySelector('.thumbnail-overlay-icon').innerHTML).toBe('');
  });

  it('should create an audio item with an icon', () => {
    const audioItem = { ...mockVideo, type: 'audio' };
    const item = createGridItem(audioItem);
    expect(item.querySelector('.thumbnail-overlay-icon').innerHTML).toContain(
      'music_note'
    );
  });

  it('should mark a favorite item correctly', () => {
    const favoriteItem = { ...mockVideo, isFavorite: true };
    const item = createGridItem(favoriteItem);
    const favoriteBtn = item.querySelector('.favorite-btn');
    expect(favoriteBtn.classList.contains('is-favorite')).toBe(true);
    expect(favoriteBtn.title).toBe('Unfavorite');
  });

  it('should handle items without a cover path', () => {
    const noCoverItem = { ...mockVideo, coverPath: null };
    const item = createGridItem(noCoverItem);
    const thumbnail = item.querySelector('.grid-thumbnail');
    expect(thumbnail.dataset.src).toBe('/path/to/assets/logo.png');
  });
});

describe('UI Logic - sortLibrary', () => {
  const lib = [
    { id: 1, title: 'B', duration: 200, downloadedAt: '2023-01-02' },
    { id: 2, title: 'C', duration: 100, downloadedAt: '2023-01-03' },
    { id: 3, title: 'A', duration: 300, downloadedAt: '2023-01-01' },
  ];

  it('should sort by title ascending', () => {
    const sorted = sortLibrary(lib, 'title-asc');
    expect(sorted.map((i) => i.id)).toEqual([3, 1, 2]);
  });

  it('should sort by title descending', () => {
    const sorted = sortLibrary(lib, 'title-desc');
    expect(sorted.map((i) => i.id)).toEqual([2, 1, 3]);
  });

  it('should sort by duration ascending', () => {
    const sorted = sortLibrary(lib, 'duration-asc');
    expect(sorted.map((i) => i.id)).toEqual([2, 1, 3]);
  });

  it('should sort by duration descending', () => {
    const sorted = sortLibrary(lib, 'duration-desc');
    expect(sorted.map((i) => i.id)).toEqual([3, 1, 2]);
  });

  it('should sort by date descending (default)', () => {
    const sorted = sortLibrary(lib, 'downloadedAt-desc');
    expect(sorted.map((i) => i.id)).toEqual([2, 1, 3]);
  });
});

describe('UI Logic - applyFilters', () => {
  const mockDate = new Date('2023-05-15T12:00:00Z');

  const mockLibrary = [
    {
      id: 1,
      type: 'video',
      duration: 100,
      source: 'youtube',
      upload_date: '20230501',
      title: 'Short YT Video',
    },
    {
      id: 2,
      type: 'audio',
      duration: 600,
      source: 'local',
      upload_date: '20230101',
      title: 'Medium Audio',
    },
    {
      id: 3,
      type: 'video',
      duration: 1500,
      source: 'youtube',
      upload_date: '20221201',
      title: 'Long YT Video',
    },
    {
      id: 4,
      type: 'video',
      duration: 200,
      source: 'local',
      upload_date: '20230510',
      title: 'Short Local Video',
    },
  ];

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    AppState.currentFilters = {
      type: 'all',
      duration: 'all',
      source: 'all',
      uploadDate: 'all',
    };
    jest.clearAllMocks();
  });

  test('should return all items when filters are default', () => {
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(4);
  });

  test('should filter by type', () => {
    AppState.currentFilters.type = 'audio';
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  test('should filter by duration (<5 min)', () => {
    AppState.currentFilters.duration = '<5';
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(2); // Items 1 and 4
  });

  test('should filter by duration (5-20 min)', () => {
    AppState.currentFilters.duration = '5-20';
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  test('should filter by duration (>20 min)', () => {
    AppState.currentFilters.duration = '>20';
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  test('should filter by source', () => {
    AppState.currentFilters.source = 'local';
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(2); // Items 2 and 4
  });

  test('should filter by date (This Month)', () => {
    AppState.currentFilters.uploadDate = 'this_month';
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(2); // Items 1 and 4
  });

  test('should filter by date (This Year)', () => {
    AppState.currentFilters.uploadDate = 'this_year';
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(3);
  });

  test('should filter by date (Older)', () => {
    AppState.currentFilters.uploadDate = 'older';
    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  test('should combine multiple filters', () => {
    AppState.currentFilters.type = 'video';
    AppState.currentFilters.source = 'local';
    AppState.currentFilters.duration = '<5';

    const result = applyFilters(mockLibrary);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });
});
