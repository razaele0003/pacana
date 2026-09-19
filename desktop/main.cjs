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
      Menu.setApplicationMenu(null);

      const windowStateFile = path.join(
        app.getPath("userData"),
        "window-state.json",
      );

      async function getSavedWindowState() {
        try {
          const raw = await fs.readFile(windowStateFile, "utf8");
          return JSON.parse(raw);
        } catch {
          return { isMaximized: true, width: 1280, height: 900 };
        }
      }

      async function persistWindowState(win) {
        if (!win || win.isDestroyed()) return;
        try {
          const isMax = win.isMaximized();
          const isFull = win.isFullScreen();
          const bounds =
            typeof win.getNormalBounds === "function" && (isMax || isFull)
              ? win.getNormalBounds()
              : win.getBounds();
          const data = {
            isMaximized: isMax || isFull,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          };
          await fs.writeFile(windowStateFile, JSON.stringify(data, null, 2));
        } catch {}
      }

      const savedState = await getSavedWindowState();
      const iconPath = path.join(__dirname, "icon.png");
      window = new BrowserWindow({
        title: "Pacana",
        icon: iconPath,
        width: savedState.width || 1280,
        height: savedState.height || 900,
        x: savedState.x,
        y: savedState.y,
        minWidth: 700,
        minHeight: 500,
        backgroundColor: "#f8f6ef",
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: "hidden",
        titleBarOverlay: {
          color: "#f8f6ef",
          symbolColor: "#40372f",
          height: 36,
        },
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
        if (!smoke) void persistWindowState(window);
        if (!isQuitting && !smoke && minimizeToTray) {
          event.preventDefault();
          window.hide();
        }
      });
      window.once("ready-to-show", () => {
        if (!smoke && savedState.isMaximized !== false) {
          window.maximize();
        }
        window.show();
      });

      const saveDebounced = () => {
        if (!smoke) void persistWindowState(window);
      };
      window.on("resize", saveDebounced);
      window.on("move", saveDebounced);

      // Native desktop context menu for inputs and selected text
      window.webContents.on("context-menu", (event, params) => {
        const { isEditable, selectionText } = params;
        if (isEditable) {
          const editMenu = Menu.buildFromTemplate([
            { role: "undo", label: "Undo" },
            { role: "redo", label: "Redo" },
            { type: "separator" },
            { role: "cut", label: "Cut" },
            { role: "copy", label: "Copy" },
            { role: "paste", label: "Paste" },
            { type: "separator" },
            { role: "selectAll", label: "Select All" },
          ]);
          editMenu.popup({ window });
        } else if (selectionText && selectionText.trim().length > 0) {
          const selectMenu = Menu.buildFromTemplate([
            { role: "copy", label: "Copy" },
            { role: "selectAll", label: "Select All" },
          ]);
          selectMenu.popup({ window });
        }
      });

      // Desktop keyboard shortcuts & fullscreen support
      window.webContents.on("before-input-event", (event, input) => {
        if (input.type === "keyDown") {
          if (input.key === "F11") {
            window.setFullScreen(!window.isFullScreen());
            event.preventDefault();
          } else if (input.key === "Escape" && window.isFullScreen()) {
            window.setFullScreen(false);
            event.preventDefault();
          } else if (
            (input.control || input.meta) &&
            (input.key === "w" || input.key === "W")
          ) {
            event.preventDefault();
            if (minimizeToTray) window.hide();
            else window.close();
          } else if (
            (input.control || input.meta) &&
            ["=", "+", "-", "_", "0"].includes(input.key)
          ) {
            event.preventDefault();
          } else if (
            !smoke &&
            (input.key === "F5" ||
              ((input.control || input.meta) &&
                (input.key === "r" || input.key === "R")))
          ) {
            event.preventDefault();
          }
        }
      });

      // Disable browser zooming
      window.webContents.setVisualZoomLevelLimits(1, 1);
      window.webContents.on("zoom-changed", () => {
        window.webContents.setZoomLevel(0);
      });

      const applyDesktopClasses = () => {
        if (!window || window.isDestroyed()) return;
        const isFull = window.isFullScreen();
        window.webContents
          .executeJavaScript(
            `
          document.body.classList.add('is-desktop');
          if (${isFull}) {
            document.body.classList.add('is-fullscreen');
          } else {
            document.body.classList.remove('is-fullscreen');
          }
        `,
          )
          .catch(() => {});
      };
      window.webContents.on("dom-ready", applyDesktopClasses);
      window.on("enter-full-screen", applyDesktopClasses);
      window.on("leave-full-screen", applyDesktopClasses);

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
              {
                label: "Toggle Fullscreen (F11)",
                click: () => {
                  if (window) {
                    if (!window.isVisible()) window.show();
                    window.setFullScreen(!window.isFullScreen());
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
