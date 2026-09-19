try {
  if (require("electron-squirrel-startup")) return;
} catch {}
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  protocol,
  session,
  dialog,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { resolveAsset } = require("./paths.cjs");
const smoke = process.argv.includes("--smoke");
app.setName("Pacana");
app.setAppUserModelId("com.pacana.desktop");
app.setPath(
  "userData",
  path.join(
    app.getPath("appData"),
    smoke ? "Pacana-Desktop-Smoke" : "Pacana-Desktop",
  ),
);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "pacana",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let window;
let tray = null;
let isQuitting = false;
let minimizeToTray = true;

app.on("before-quit", () => {
  isQuitting = true;
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      if (!window.isVisible()) window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const root = path.join(__dirname, "../dist/vercel");
      protocol.handle("pacana", async (request) => {
        const asset = resolveAsset(root, request.url);
        if (!asset || request.method !== "GET")
          return new Response("Not found", { status: 404 });
        try {
          const types = {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".webp": "image/webp",
            ".png": "image/png",
            ".ttf": "font/ttf",
            ".woff2": "font/woff2",
          };
          return new Response(await fs.readFile(asset), {
            headers: {
              "Content-Type":
                types[path.extname(asset)] || "application/octet-stream",
              "Content-Security-Policy":
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      });
      session.defaultSession.setPermissionRequestHandler(
        (contents, permission, callback) =>
          callback(
            contents === window?.webContents &&
              contents.getURL().startsWith("pacana://app/") &&
              permission === "notifications",
          ),
      );
      session.defaultSession.setPermissionCheckHandler(
        (contents, permission, origin) =>
          contents === window?.webContents &&
          origin === "pacana://app" &&
          permission === "notifications",
      );
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "Pacana",
            submenu: [
              { label: "Fullscreen", role: "togglefullscreen" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          {
            label: "Edit",
            submenu: [
              { role: "undo" },
              { role: "redo" },
              { type: "separator" },
              { role: "cut" },
              { role: "copy" },
              { role: "paste" },
              { role: "selectAll" },
            ],
          },
          {
            label: "View",
            submenu: [
              { role: "reload" },
              { role: "resetZoom" },
              { role: "zoomIn" },
              { role: "zoomOut" },
            ],
          },
        ]),
      );
      const iconPath = path.join(__dirname, "icon.png");
      window = new BrowserWindow({
        title: "Pacana",
        icon: iconPath,
        width: 1280,
        height: 900,
        minWidth: 390,
        minHeight: 600,
        backgroundColor: "#f7f5ed",
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          backgroundThrottling: false,
          webSecurity: true,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith("pacana://app/")) event.preventDefault();
      });
      window.on("close", (event) => {
        if (!isQuitting && !smoke && minimizeToTray) {
          event.preventDefault();
          window.hide();
        }
      });
      window.once("ready-to-show", () => window.show());
      await window.loadURL("pacana://app/app");

      if (!smoke) {
        try {
          const trayIconPath = path.join(__dirname, "tray-icon.png");
          const trayIcon = nativeImage.createFromPath(trayIconPath);
          tray = new Tray(trayIcon);
          tray.setToolTip("Pacana — Cozy Focus & Time Journal");

          const updateTrayMenu = () => {
            const loginSettings = app.getLoginItemSettings();
            const contextMenu = Menu.buildFromTemplate([
              {
                label: "Show Pacana",
                click: () => {
                  if (window) {
                    if (window.isMinimized()) window.restore();
                    window.show();
                    window.focus();
                  }
                },
              },
              { type: "separator" },
              {
                label: "Launch on Startup",
                type: "checkbox",
                checked: loginSettings.openAtLogin,
                click: (item) => {
                  app.setLoginItemSettings({
                    openAtLogin: item.checked,
                    path: process.execPath,
                  });
                  updateTrayMenu();
                },
              },
              {
                label: "Minimize to Tray on Close",
                type: "checkbox",
                checked: minimizeToTray,
                click: (item) => {
                  minimizeToTray = item.checked;
                  updateTrayMenu();
                },
              },
              { type: "separator" },
              {
                label: "Quit Pacana",
                click: () => {
                  isQuitting = true;
                  app.quit();
                },
              },
            ]);
            tray.setContextMenu(contextMenu);
          };

          updateTrayMenu();

          tray.on("click", () => {
            if (window) {
              if (window.isVisible() && !window.isMinimized()) {
                if (window.isFocused()) {
                  window.hide();
                } else {
                  window.focus();
                }
              } else {
                if (window.isMinimized()) window.restore();
                window.show();
                window.focus();
              }
            }
          });
        } catch (err) {
          console.error("Failed to initialize tray:", err);
        }
      }
      if (smoke) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1800));
          const result = await window.webContents
            .executeJavaScript(`(async () => {
          const text = document.body.innerText;
          if (!text.includes('Make space for focus.')) throw new Error('Focus UI did not load');
          if (typeof window.require !== 'undefined') throw new Error('Node leaked into renderer');
          const db = await new Promise((resolve,reject) => { const r=indexedDB.open('desktop-smoke',1); r.onupgradeneeded=()=>r.result.createObjectStore('checks'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
          const tx=db.transaction('checks','readwrite'); tx.objectStore('checks').put('saved','persistence'); await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=reject;}); db.close();
          return {title:document.title, focusLoaded:true, isolated:true, storage:true};
        })()`);
          await window.reload();
          await new Promise((resolve) => setTimeout(resolve, 1800));
          const persisted = await window.webContents.executeJavaScript(
            `new Promise((resolve,reject)=>{const r=indexedDB.open('desktop-smoke');r.onsuccess=()=>{const q=r.result.transaction('checks').objectStore('checks').get('persistence');q.onsuccess=()=>{resolve(q.result==='saved');r.result.close();};q.onerror=reject;};r.onerror=reject;})`,
          );
          if (!persisted) throw new Error("Storage did not survive reload");
          await fs.mkdir(path.join(process.cwd(), ".cache"), {
            recursive: true,
          });
          await fs.writeFile(
            path.join(process.cwd(), ".cache/desktop-smoke.png"),
            (await window.webContents.capturePage()).toPNG(),
          );
          await fs.writeFile(
            path.join(process.cwd(), ".cache/desktop-smoke.json"),
            JSON.stringify({ ...result, persisted }, null, 2),
          );
          console.log(JSON.stringify({ ...result, persisted }));
          app.exit(0);
        } catch (error) {
          console.error(error);
          app.exit(1);
        }
      }
    })
    .catch((error) => {
      dialog.showErrorBox("Pacana could not open", error.message);
      app.exit(1);
    });
  app.on("window-all-closed", () => {
    if (isQuitting || smoke || !minimizeToTray) {
      app.quit();
    }
  });
}
