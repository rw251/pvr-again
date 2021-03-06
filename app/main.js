const electron = require('electron');
const path = require('path');
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

console.log('main', 'start');

const {
  app,
  BrowserWindow,
} = electron;

// simple parameters initialization
const electronConfig = {
  URL_LAUNCHER_TOUCH: process.env.URL_LAUNCHER_TOUCH === '1' ? 1 : 0,
  URL_LAUNCHER_TOUCH_SIMULATE: process.env.URL_LAUNCHER_TOUCH_SIMULATE === '1' ? 1 : 0,
  URL_LAUNCHER_FRAME: process.env.URL_LAUNCHER_FRAME === '1' ? 1 : 0,
  URL_LAUNCHER_KIOSK: process.env.URL_LAUNCHER_KIOSK === '1' ? 1 : 0,
  URL_LAUNCHER_NODE: process.env.URL_LAUNCHER_NODE === '0' ? 0 : 1,
  URL_LAUNCHER_WIDTH: parseInt(process.env.URL_LAUNCHER_WIDTH || 1920, 10),
  URL_LAUNCHER_HEIGHT: parseInt(process.env.URL_LAUNCHER_HEIGHT || 1080, 10),
  URL_LAUNCHER_TITLE: process.env.URL_LAUNCHER_TITLE || 'BALENA.IO',
  URL_LAUNCHER_CONSOLE: process.env.URL_LAUNCHER_CONSOLE === '1' ? 1 : 0,
  URL_LAUNCHER_URL: process.env.URL_LAUNCHER_URL || `file:///${path.join(__dirname, 'data', 'index.html')}`,
  URL_LAUNCHER_ZOOM: parseFloat(process.env.URL_LAUNCHER_ZOOM || 1.0),
  URL_LAUNCHER_OVERLAY_SCROLLBARS: process.env.URL_LAUNCHER_OVERLAY_SCROLLBARS === '1' ? 1 : 0,
  ELECTRON_ENABLE_HW_ACCELERATION: process.env.ELECTRON_ENABLE_HW_ACCELERATION === '1',
  ELECTRON_BALENA_UPDATE_LOCK: process.env.ELECTRON_BALENA_UPDATE_LOCK === '1',
  ELECTRON_APP_DATA_DIR: process.env.ELECTRON_APP_DATA_DIR,
  ELECTRON_USER_DATA_DIR: process.env.ELECTRON_USER_DATA_DIR,
};

console.log('Enable / disable hardware acceleration');
if (!electronConfig.ELECTRON_ENABLE_HW_ACCELERATION) {
  console.log('doing it');
  app.disableHardwareAcceleration();
}

console.log('enable touch events if your device supports them');
if (electronConfig.URL_LAUNCHER_TOUCH) {
  console.log('doing it');
  app.commandLine.appendSwitch('--touch-devices');
}
console.log('simulate touch events - might be useful for touchscreen with partial driver support');
if (electronConfig.URL_LAUNCHER_TOUCH_SIMULATE) {
  console.log('doing it');
  app.commandLine.appendSwitch('--simulate-touch-screen-with-mouse');
}

console.log('Override the appData directory');
// See https://electronjs.org/docs/api/app#appgetpathname
if (electronConfig.ELECTRON_APP_DATA_DIR) {
  console.log('doing it');
  electron.app.setPath('appData', electronConfig.ELECTRON_APP_DATA_DIR);
}

console.log('Override the userData directory');
// NOTE: `userData` defaults to the `appData` directory appended with the app's name
if (electronConfig.ELECTRON_USER_DATA_DIR) {
  console.log('doing it');
  electron.app.setPath('userData', electronConfig.ELECTRON_USER_DATA_DIR);
}

if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode');
  Object.assign(electronConfig, {
    URL_LAUNCHER_HEIGHT: 600,
    URL_LAUNCHER_WIDTH: 800,
    URL_LAUNCHER_KIOSK: 0,
    URL_LAUNCHER_CONSOLE: 1,
    URL_LAUNCHER_FRAME: 1,
  });
}

console.log('update-lock');
// Listen for a 'update-lock' to either enable, disable or check
// the update lock from the renderer process (i.e. the app)
if (electronConfig.ELECTRON_BALENA_UPDATE_LOCK) {
  console.log('doing it');
  const lockFile = require('lockfile');
  electron.ipcMain.on('update-lock', (event, command) => {
    switch (command) {
      case 'lock':
        lockFile.lock('/tmp/balena/updates.lock', (error) => {
          event.sender.send('update-lock', error);
        });
        break;
      case 'unlock':
        lockFile.unlock('/tmp/balena/updates.lock', (error) => {
          event.sender.send('update-lock', error);
        });
        break;
      case 'check':
        lockFile.check('/tmp/balena/updates.lock', (error, isLocked) => {
          event.sender.send('update-lock', error, isLocked);
        });
        break;
      default:
        event.sender.send('update-lock', new Error(`Unknown command "${command}"`));
        break;
    }
  });
}

/*
 we initialize our application display as a callback of the electronJS "ready" event
 */
app.on('ready', () => {
  // here we actually configure the behavour of electronJS
  mainWindow = new BrowserWindow({
    width: electronConfig.URL_LAUNCHER_WIDTH,
    height: electronConfig.URL_LAUNCHER_HEIGHT,
    frame: !!(electronConfig.URL_LAUNCHER_FRAME),
    title: electronConfig.URL_LAUNCHER_TITLE,
    kiosk: !!(electronConfig.URL_LAUNCHER_KIOSK),
    webPreferences: {
      sandbox: false,
      nodeIntegration: !!(electronConfig.URL_LAUNCHER_NODE),
      zoomFactor: electronConfig.URL_LAUNCHER_ZOOM,
      overlayScrollbars: !!(electronConfig.URL_LAUNCHER_OVERLAY_SCROLLBARS),
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      mainWindow.show();
    }, 300);
  });

  // if the env-var is set to true,
  // a portion of the screen will be dedicated to the chrome-dev-tools
  if (electronConfig.URL_LAUNCHER_CONSOLE) {
    mainWindow.webContents.openDevTools();
  }

  process.on('uncaughtException', (err) => {
    console.log(err);
  });

  console.log('about to launch');
  console.log(electronConfig.URL_LAUNCHER_URL);
  // the big red button, here we go
  mainWindow.loadURL(electronConfig.URL_LAUNCHER_URL);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
const WebSocketServer = require('websocket').server;
const http = require('http');

console.log('creating server');
const server = http.createServer((req, res) => {
  // allow cors
  res.setHeader('Access-Control-Allow-Origin', '*');
});
server.listen(8812, () => { console.log('SERVER LISTENEING'); });

// create the server
const wsServer = new WebSocketServer({
  httpServer: server,
});

wsServer.on('connect', (connection) => {
  console.log('user connected');
  connection.send('welcome');
});
// WebSocket server
wsServer.on('request', (request) => {
  console.log('RQST');
  const connection = request.accept(null, request.origin);

  // This is the most important callback for us, we'll handle
  // all messages from users here.
  connection.on('message', (message) => {
    if (message.type === 'utf8') {
      // process WebSocket message
      const msg = JSON.parse(message.utf8Data);
      if (msg.type === 'button') {
        mainWindow.webContents.send('button', msg.value);
        console.log(`Button pressed: ${msg.value}`);
      }
    }
  });

  connection.on('close', () => {
    // close user connection
    console.log('closed');
  });
});
