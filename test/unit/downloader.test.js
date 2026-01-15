const Downloader = require('../../src/main/downloader');
const path = require('path');
const events = require('events');
const fs = require('fs');

// Mock dependencies
const mockSpawnPython = jest.fn();
const mockGetSettings = jest.fn();
const mockDb = {
  addOrUpdateVideo: jest.fn(),
  addVideoToPlaylist: jest.fn(),
  addToHistory: jest.fn(),
  findOrCreateArtist: jest.fn(),
  linkVideoToArtist: jest.fn(),
};
const mockBrowserDiscovery = {
  resolveBrowser: jest.fn(),
};
const mockWin = {
  webContents: {
    send: jest.fn(),
  },
};

// Mock python-core
jest.mock('../../src/main/python-core', () => ({
  spawnPython: (...args) => mockSpawnPython(...args),
  getPythonDetails: () => ({ pythonPath: 'python', binDir: 'bin' }),
}));

// Mock fs and fse
jest.mock('fs');
jest.mock('fs-extra', () => ({
  move: jest.fn(),
}));

// Helper to flush promises
const flushPromises = () =>
  new Promise((resolve) => {
    if (global.setImmediate) {
      global.setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });

const waitTick = async () => {
  // Ensure enough microtask cycles for the async chain in postProcess
  for (let i = 0; i < 50; i++) {
    await Promise.resolve();
  }
  await flushPromises();
};

describe('Downloader', () => {
  let downloader;
  let mockProcess;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSettings.mockReturnValue({
      concurrentDownloads: 3,
      cookieBrowser: 'none',
      downloadSubs: false,
      downloadAutoSubs: false,
      removeSponsors: false,
      concurrentFragments: 1,
      speedLimit: '',
    });

    mockProcess = new events.EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.stdout = new events.EventEmitter();
    mockProcess.stderr = new events.EventEmitter();
    mockSpawnPython.mockReturnValue(mockProcess);

    downloader = new Downloader({
      getSettings: mockGetSettings,
      videoPath: '/mock/video/path',
      coverPath: '/mock/cover/path',
      subtitlePath: '/mock/subtitle/path',
      db: mockDb,
      BrowserDiscovery: mockBrowserDiscovery,
      win: mockWin,
      resolveFfmpegPath: async () => '/mock/ffmpeg',
    });

    // Mock fs.promises
    fs.promises = {
      readdir: jest.fn(),
      readFile: jest.fn(),
      unlink: jest.fn(),
    };
  });

  test('should start download and process queue', async () => {
    const job = {
      videoInfo: {
        id: '123',
        webpage_url: 'http://test.com',
        title: 'Test Video',
      },
      downloadType: 'video',
      quality: 'best',
    };

    downloader.addToQueue([job]);
    await waitTick();

    expect(mockSpawnPython).toHaveBeenCalled();
    expect(downloader.activeDownloads.has('123')).toBe(true);

    mockProcess.stdout.emit(
      'data',
      '[download]  50.0% of 10.00MiB at  2.00MiB/s ETA 00:05'
    );
    expect(mockWin.webContents.send).toHaveBeenCalledWith(
      'download-progress',
      expect.objectContaining({
        id: '123',
        percent: 50.0,
      })
    );

    // Mock fs.promises for post-process
    fs.promises.readdir.mockResolvedValue([
      '123.info.json',
      '123.mp4',
      '123.jpg',
    ]);
    fs.promises.readFile.mockResolvedValue(
      JSON.stringify({
        id: '123',
        title: 'Test Video',
        uploader: 'Tester',
        duration: 100,
        upload_date: '20230101',
        webpage_url: 'http://test.com',
      })
    );
    fs.promises.unlink.mockResolvedValue();

    mockProcess.emit('close', 0);
    await waitTick();

    expect(mockWin.webContents.send).toHaveBeenCalledWith(
      'download-complete',
      expect.anything()
    );
    expect(mockDb.addOrUpdateVideo).toHaveBeenCalled();
    expect(downloader.activeDownloads.has('123')).toBe(false);
  });

  test('resolves static ffmpeg binary when only Scripts directory is returned on Windows', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(
      process,
      'platform'
    );
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    const scriptsDir = path.join(
      'C:',
      'pyvenv',
      'python-win-x64',
      'Scripts'
    );
    const staticPath = path.join(
      path.dirname(scriptsDir),
      'Lib',
      'site-packages',
      'static_ffmpeg',
      'bin',
      'win32',
      'ffmpeg.exe'
    );

    fs.existsSync.mockImplementation((p) => p === staticPath);
    fs.statSync.mockImplementation((p) => ({
      isFile: () => p === staticPath,
      isDirectory: () => false,
    }));

    downloader.resolveFfmpegPath = async () => scriptsDir;

    const job = {
      videoInfo: {
        id: 'win',
        webpage_url: 'http://win.com',
        title: 'Win Video',
      },
      downloadType: 'video',
      quality: 'best',
    };

    downloader.addToQueue([job]);
    await waitTick();

    const args = mockSpawnPython.mock.calls[0][0];
    const ffmpegIndex = args.indexOf('--ffmpeg-location');
    expect(ffmpegIndex).toBeGreaterThan(-1);
    expect(args[ffmpegIndex + 1]).toBe(staticPath);

    Object.defineProperty(process, 'platform', originalPlatform);
    fs.existsSync.mockReset();
    fs.statSync.mockReset();
  });

  test('should handle download errors', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const job = {
      videoInfo: {
        id: 'fail',
        webpage_url: 'http://fail.com',
        title: 'Fail Video',
      },
      downloadType: 'video',
      quality: 'best',
    };

    downloader.addToQueue([job]);
    await waitTick();

    mockProcess.stderr.emit('data', 'ERROR: Video unavailable');
    mockProcess.emit('close', 1);
    await waitTick();

    expect(mockWin.webContents.send).toHaveBeenCalledWith(
      'download-error',
      expect.objectContaining({
        error: 'This video is unavailable.',
      })
    );
    expect(mockDb.addToHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
      })
    );

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should detect stalled downloads', async () => {
    jest.useFakeTimers();
    const job = {
      videoInfo: {
        id: 'stall',
        webpage_url: 'http://stall.com',
        title: 'Stall Video',
      },
      downloadType: 'video',
      quality: 'best',
    };

    downloader.addToQueue([job]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(121000);
    expect(mockProcess.kill).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('should NOT detect stall if progress continues slowly (bad internet simulation)', async () => {
    jest.useFakeTimers();
    const job = {
      videoInfo: {
        id: 'slow',
        webpage_url: 'http://slow.com',
        title: 'Slow Video',
      },
      downloadType: 'video',
      quality: 'best',
    };

    downloader.addToQueue([job]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(80000);
    mockProcess.stdout.emit('data', '[download]  10.0% ...');
    expect(mockProcess.kill).not.toHaveBeenCalled();

    jest.advanceTimersByTime(80000);
    mockProcess.stdout.emit('data', '[download]  20.0% ...');
    expect(mockProcess.kill).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('should handle concurrent downloads limit', async () => {
    mockGetSettings.mockReturnValue({
      concurrentDownloads: 2,
      cookieBrowser: 'none',
    });

    mockSpawnPython.mockClear();

    // Create a fresh instance
    downloader = new Downloader({
      getSettings: mockGetSettings,
      videoPath: '/mock/video/path',
      coverPath: '/mock/cover/path',
      subtitlePath: '/mock/subtitle/path',
      db: mockDb,
      BrowserDiscovery: mockBrowserDiscovery,
      win: mockWin,
      resolveFfmpegPath: async () => '/mock/ffmpeg',
    });

    // We must ensure that the fresh instance uses the same global fs.promises mock, which it does.

    const jobs = [
      { videoInfo: { id: '1', title: 'V1' }, downloadType: 'video' },
      { videoInfo: { id: '2', title: 'V2' }, downloadType: 'video' },
      { videoInfo: { id: '3', title: 'V3' }, downloadType: 'video' },
    ];

    downloader.addToQueue(jobs);
    await waitTick();

    expect(mockSpawnPython).toHaveBeenCalledTimes(2);
    expect(downloader.activeDownloads.size).toBe(2);
    expect(downloader.queue.length).toBe(1);
  });
});

describe('Downloader Concurrency', () => {
  let downloader;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSettings.mockReturnValue({
      concurrentDownloads: 2,
      cookieBrowser: 'none',
    });

    mockSpawnPython.mockImplementation(() => {
      const p = new events.EventEmitter();
      p.kill = jest.fn();
      p.stdout = new events.EventEmitter();
      p.stderr = new events.EventEmitter();
      return p;
    });

    downloader = new Downloader({
      getSettings: mockGetSettings,
      videoPath: '/mock',
      coverPath: '/mock',
      subtitlePath: '/mock',
      db: mockDb,
      BrowserDiscovery: mockBrowserDiscovery,
      win: mockWin,
      resolveFfmpegPath: async () => '/mock/ffmpeg',
    });

    fs.promises = {
      readdir: jest.fn(),
      readFile: jest.fn(),
      unlink: jest.fn(),
    };
  });

  test('should respect concurrent limit and start queued items when one finishes', async () => {
    const jobs = [
      { videoInfo: { id: '1', title: 'V1' }, downloadType: 'video' },
      { videoInfo: { id: '2', title: 'V2' }, downloadType: 'video' },
      { videoInfo: { id: '3', title: 'V3' }, downloadType: 'video' },
    ];

    downloader.addToQueue(jobs);
    await waitTick();

    expect(downloader.activeDownloads.size).toBe(2);

    fs.promises.readdir.mockResolvedValue(['1.info.json', '1.mp4']);
    fs.promises.readFile.mockResolvedValue(
      JSON.stringify({ id: '1', title: 'V1' })
    );
    fs.promises.unlink.mockResolvedValue();

    const p1 = downloader.activeDownloads.get('1');
    p1.emit('close', 0);

    await waitTick();

    expect(downloader.activeDownloads.has('1')).toBe(false);
    expect(downloader.activeDownloads.has('3')).toBe(true);
    expect(downloader.activeDownloads.size).toBe(2);
  });
});
