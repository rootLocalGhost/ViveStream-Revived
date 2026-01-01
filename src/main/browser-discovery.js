const fs = require('fs');
const path = require('path');
const os = require('os');


const HOME = os.homedir() || '';


const getWinPath = (key) => process.env[key] || '';



const BROWSER_PATHS = {
  brave: {
    linux: [

      path.join(HOME, '.config', 'BraveSoftware', 'Brave-Browser'),

      path.join(
        HOME,
        '.var',
        'app',
        'com.brave.Browser',
        'config',
        'BraveSoftware',
        'Brave-Browser'
      ),

      path.join(
        HOME,
        'snap',
        'brave',
        'current',
        '.config',
        'BraveSoftware',
        'Brave-Browser'
      ),
    ],
    win32: [
      path.join(
        getWinPath('LOCALAPPDATA'),
        'BraveSoftware',
        'Brave-Browser',
        'User Data'
      ),
    ],
  },
  chrome: {
    linux: [
      path.join(HOME, '.config', 'google-chrome'),
      path.join(
        HOME,
        '.var',
        'app',
        'com.google.Chrome',
        'config',
        'google-chrome'
      ),
    ],
    win32: [
      path.join(getWinPath('LOCALAPPDATA'), 'Google', 'Chrome', 'User Data'),
    ],
  },
  chromium: {
    linux: [
      path.join(HOME, '.config', 'chromium'),
      path.join(
        HOME,
        '.var',
        'app',
        'org.chromium.Chromium',
        'config',
        'chromium'
      ),
    ],
    win32: [],
  },
  edge: {
    linux: [
      path.join(HOME, '.config', 'microsoft-edge'),
      path.join(
        HOME,
        '.var',
        'app',
        'com.microsoft.Edge',
        'config',
        'microsoft-edge'
      ),
    ],
    win32: [
      path.join(getWinPath('LOCALAPPDATA'), 'Microsoft', 'Edge', 'User Data'),
    ],
  },
  firefox: {
    linux: [
      path.join(HOME, '.mozilla', 'firefox'),
      path.join(
        HOME,
        '.var',
        'app',
        'org.mozilla.firefox',
        '.mozilla',
        'firefox'
      ),
      path.join(HOME, 'snap', 'firefox', 'common', '.mozilla', 'firefox'),
    ],
    win32: [path.join(getWinPath('APPDATA'), 'Mozilla', 'Firefox', 'Profiles')],
  },
  opera: {
    linux: [
      path.join(HOME, '.config', 'opera'),
      path.join(HOME, '.var', 'app', 'com.opera.Opera', 'config', 'opera'),
    ],
    win32: [path.join(getWinPath('APPDATA'), 'Opera Software', 'Opera Stable')],
  },
  vivaldi: {
    linux: [
      path.join(HOME, '.config', 'vivaldi'),
      path.join(
        HOME,
        '.var',
        'app',
        'com.vivaldi.Vivaldi',
        'config',
        'vivaldi'
      ),
    ],
    win32: [path.join(getWinPath('LOCALAPPDATA'), 'Vivaldi', 'User Data')],
  },
};


function isValidBrowserPath(p, browserName) {
  try {
    if (!p || !fs.existsSync(p)) return false;




    return true;
  } catch (e) {
    return false;
  }
}


function findPathForBrowser(browserName) {
  const platform = process.platform;
  const candidates = BROWSER_PATHS[browserName]?.[platform];

  if (!candidates) return null;

  for (const candidate of candidates) {
    if (isValidBrowserPath(candidate, browserName)) {
      return candidate;
    }
  }
  return null;
}


function resolveBrowser(userSelection) {
  if (!userSelection || userSelection === 'none') return null;

  const browserList = [
    'brave',
    'chrome',
    'firefox',
    'edge',
    'chromium',
    'opera',
    'vivaldi',
  ];


  if (userSelection === 'auto') {
    console.log('[Cookies] Auto-detecting browser...');
    for (const browser of browserList) {
      const foundPath = findPathForBrowser(browser);
      if (foundPath) {
        console.log(`[Cookies] Auto-detected: ${browser} at ${foundPath}`);


        return `${browser}:${foundPath}`;
      }
    }
    console.warn('[Cookies] Auto-detection failed. No browsers found.');
    return null;
  }


  const foundPath = findPathForBrowser(userSelection);
  if (foundPath) {
    console.log(`[Cookies] Resolved ${userSelection} to: ${foundPath}`);
    return `${userSelection}:${foundPath}`;
  }



  console.log(
    `[Cookies] Could not locate path for ${userSelection}, using default.`
  );
  return userSelection;
}

module.exports = {
  resolveBrowser,
};
