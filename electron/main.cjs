const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const APP_ID = 'com.kenigsfels.loungeos';
const PROTOCOL = 'loungeos';
const DEV_SERVER_URL = process.env.LOUNGEOS_DEV_SERVER_URL;
const DATA_ROOT = process.env.LOUNGEOS_DATA_ROOT
  || path.join(process.env.USERPROFILE || '', 'Desktop', 'LoungeOS');
const SCHEDULE_DATA_PATH = path.join(DATA_ROOT, 'schedule', 'app-schedule.json');
const ALLOWED_ROUTES = new Set([
  'dashboard',
  'employees',
  'schedule',
  'salary',
  'warehouse',
  'knowledge',
  'training',
  'tasks',
  'settings'
]);

let mainWindow;
let pendingRoute = getRouteFromArguments(process.argv);

ipcMain.handle('schedule:load', async () => {
  try {
    const stats = await fs.stat(SCHEDULE_DATA_PATH);
    if (stats.size > 2 * 1024 * 1024) throw new Error('Schedule file is too large');
    const content = await fs.readFile(SCHEDULE_DATA_PATH, 'utf8');
    return JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    return { version: 1, currentWeek: '', source: null, weeks: [] };
  }
});

app.setAppUserModelId(APP_ID);
app.enableSandbox();

if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const route = getRouteFromArguments(commandLine);
    showMainWindow(route);
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  showMainWindow(getRouteFromProtocol(url));
});

function getRouteFromProtocol(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const candidate = parsed.hostname === 'open'
      ? parsed.pathname.replace(/^\//, '')
      : parsed.hostname;
    return ALLOWED_ROUTES.has(candidate) ? candidate : 'dashboard';
  } catch {
    return 'dashboard';
  }
}

function getRouteFromArguments(args) {
  const protocolUrl = args.find((argument) => argument.startsWith(`${PROTOCOL}://`));
  return protocolUrl ? getRouteFromProtocol(protocolUrl) : null;
}

function isInternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);

    if (DEV_SERVER_URL) {
      return parsed.origin === new URL(DEV_SERVER_URL).origin;
    }

    return parsed.protocol === 'file:';
  } catch {
    return false;
  }
}

function openExternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);

    if (parsed.protocol === `${PROTOCOL}:`) {
      showMainWindow(getRouteFromProtocol(targetUrl));
      return;
    }

    if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
      shell.openExternal(targetUrl);
    }
  } catch {
    // Invalid and unsupported links stay blocked.
  }
}

function loadApplication(route = null) {
  const hash = route || 'dashboard';

  if (DEV_SERVER_URL) {
    return mainWindow.loadURL(`${DEV_SERVER_URL}/#${hash}`);
  }

  return mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash });
}

function showMainWindow(route = null) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingRoute = route || pendingRoute;
    return;
  }

  if (route) {
    loadApplication(route);
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'LoungeOS',
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#07100e',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  loadApplication(pendingRoute);
  pendingRoute = null;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
