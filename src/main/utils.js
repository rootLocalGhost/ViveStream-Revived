const fs = require('fs');
const path = require('path');






function parseArtistNames(artistString) {
  if (!artistString) return ['Unknown'];






  const splitRegex = /;|\s+feat\.?\s+|\s+ft\.?\s+/i;

  return artistString
    .split(splitRegex)
    .map((name) => name.trim())
    .filter(
      (name) =>
        name.length > 0 &&
        name.toLowerCase() !== 'topic' &&
        name.toLowerCase() !== 'various artists'
    );
}

function parseYtDlpError(stderr) {
  if (stderr.includes('ffmpeg not found'))
    return 'FFmpeg binary missing. Please re-run the app or check internet connection.';
  if (stderr.includes('Private video')) return 'This video is private.';
  if (stderr.includes('Video unavailable')) return 'This video is unavailable.';
  const match = stderr.match(/ERROR: (.*)/);
  return match ? match[1].trim() : stderr.split('\n').pop() || 'Unknown error';
}

module.exports = {
  parseArtistNames,
  parseYtDlpError,
};
