const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'dashboard.html'));
}

function showUpdateDialog(options) {
  if (mainWindow && !mainWindow.isDestroyed()) return dialog.showMessageBox(mainWindow, options);
  return dialog.showMessageBox(options);
}

function configureAutoUpdates() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', error => {
    console.error('No se pudo actualizar Leyra Seguridad:', error);
  });
  autoUpdater.on('update-available', async updateInfo => {
    try {
      const { response } = await showUpdateDialog({
        type: 'info',
        title: 'Actualización disponible',
        message: `Hay una nueva versión de Leyra Seguridad (${updateInfo.version}).`,
        detail: 'Podés descargarla ahora; la aplicación se actualizará al cerrarla.',
        buttons: ['Descargar actualización', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
      });
      if (response === 0) await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('No se pudo iniciar la descarga de la actualización:', error);
    }
  });
  autoUpdater.on('update-downloaded', async updateInfo => {
    try {
      const { response } = await showUpdateDialog({
        type: 'info',
        title: 'Actualización descargada',
        message: `La versión ${updateInfo.version} está lista para instalarse.`,
        detail: 'Podés reiniciar ahora o continuar trabajando; se instalará cuando cierres la aplicación.',
        buttons: ['Reiniciar y actualizar', 'Continuar trabajando'],
        defaultId: 0,
        cancelId: 1
      });
      if (response === 0) autoUpdater.quitAndInstall();
    } catch (error) {
      console.error('No se pudo instalar la actualización descargada:', error);
    }
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(error => {
      console.error('No se pudo buscar actualizaciones de Leyra Seguridad:', error);
    });
  }, 8000);
}

app.whenReady().then(() => {
  createWindow();
  configureAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
