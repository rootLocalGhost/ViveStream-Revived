const path = require('path');
const binaries = require('../../src/main/binaries');
const fs = require('fs');

jest.mock('fs');
jest.mock('electron', () => ({
  app: { isPackaged: false }
}));

describe('Binaries Module', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
    jest.clearAllMocks();
  });

  test('should return correct path for yt-dlp on Linux', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });
    fs.existsSync.mockReturnValue(true);
    fs.chmodSync.mockImplementation(() => {});

    const p = binaries.getYtDlp();
    expect(p).toContain('yt-dlp_linux');
    expect(fs.chmodSync).toHaveBeenCalledWith(p, 0o755);
  });

  test('should return correct path for yt-dlp on Windows', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });
    
    const p = binaries.getYtDlp();
    expect(p).toContain('yt-dlp.exe');
    expect(fs.chmodSync).not.toHaveBeenCalled();
  });

  test('should return correct path for ffmpeg on Linux', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });
    fs.existsSync.mockReturnValue(true);
    
    const p = binaries.getFfmpeg();
    expect(p).toContain('ffmpeg');
    expect(p).not.toContain('.exe');
    expect(fs.chmodSync).toHaveBeenCalled();
  });

  test('should return correct path for ffmpeg on Windows', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });

    const p = binaries.getFfmpeg();
    expect(p).toContain('ffmpeg.exe');
  });

  test('should handle chmod errors gracefully', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });
    fs.existsSync.mockReturnValue(true);
    fs.chmodSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    binaries.getYtDlp();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to chmod'));
    consoleSpy.mockRestore();
  });
});
