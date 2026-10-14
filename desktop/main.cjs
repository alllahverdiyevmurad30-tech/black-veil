'use strict';
// Electron wrapper for BLACK VEIL. The game itself is unchanged: this window just serves the same files the browser launcher
// serves. A custom, privileged `blackveil://game/` scheme is used instead of file:// (ES modules are blocked on file://) and instead of
// a random localhost port (localStorage is per-origin, so a changing port would lose settings and saves between launches).
const { app, BrowserWindow, protocol, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { resolveRequest, mimeFor } = require('./files.cjs');

const ROOT = path.join(__dirname, '..');           // inside app.asar when packaged (fs is asar-aware in Electron)
const ORIGIN = 'blackveil://game/';

protocol.registerSchemesAsPrivileged([
  { scheme: 'blackveil', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');   // Web Audio starts without an extra click

const gotLock = app.requestSingleInstanceLock();                              // two instances would fight over the same saves
if (!gotLock) app.quit();
else app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, show: false, backgroundColor: '#05080c', title: 'BLACK VEIL', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged, backgroundThrottling: false },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) e.preventDefault(); });
  win.webContents.on('before-input-event', (e, input) => {                        // F11 toggles fullscreen (Esc stays reserved for pointer-lock/pause)
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.on('render-process-gone', (_e, d) => dialog.showErrorBox('BLACK VEIL stopped', `The game process ended unexpectedly (${d.reason}). Please restart the game.`));
  win.webContents.on('did-fail-load', (_e, code, desc) => dialog.showErrorBox('BLACK VEIL could not load', `${desc} (${code})`));
  win.loadURL(ORIGIN + 'index.html');
}

app.whenReady().then(() => {
  if (!gotLock) return;
  if (!fs.existsSync(path.join(ROOT, 'vendor', 'three.min.js'))) {
    dialog.showErrorBox('BLACK VEIL', 'vendor/three.min.js is missing from this build. Run "npm run prepare:vendor" before packaging.');
    return app.quit();
  }
  protocol.handle('blackveil', async req => {
    const file = resolveRequest(ROOT, new URL(req.url).pathname);
    if (!file) return new Response('Not found', { status: 404 });
    try { return new Response(await fs.promises.readFile(file), { headers: { 'content-type': mimeFor(file), 'cache-control': 'no-store' } }); }
    catch { return new Response('Not found', { status: 404 }); }
  });
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
