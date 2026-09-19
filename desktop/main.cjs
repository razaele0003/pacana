try {
  const checkSquirrelStartup = require("./squirrel-startup.cjs");
  if (checkSquirrelStartup()) return;
} catch {
  try {
    if (require("electron-squirrel-startup")) return;
  } catch {}
}
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  protocol,
  session,
  dialog,
  ipcMain,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { resolveAsset } = require("./paths.cjs");
const smoke = process.argv.includes("--smoke");
const testFullscreen = process.argv.includes("--test-fullscreen");
app.setName("Pacana");
app.setAppUserModelId("com.pacana.desktop");
app.setPath(
  "userData",
  path.join(
    app.getPath("appData"),
    smoke || testFullscreen ? "Pacana-Desktop-Smoke" : "Pacana-Desktop",
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

if (!smoke && !testFullscreen && !app.requestSingleInstanceLock()) app.quit();
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
      const audioDir = path.join(app.getPath("userData"), "audio");
      try {
        await fs.mkdir(audioDir, { recursive: true });
      } catch {}

      protocol.handle("pacana", async (request) => {
        if (request.method !== "GET")
          return new Response("Not found", { status: 404 });

        try {
          const url = new URL(request.url);
          if (url.protocol !== "pacana:" || url.hostname !== "app") {
            return new Response("Not found", { status: 404 });
          }

          const pathname = decodeURIComponent(url.pathname);

          // Audio files from persistent app data
          if (pathname.startsWith("/audio/")) {
            const audioId = pathname.slice("/audio/".length);
            if (!/^[a-zA-Z0-9_\-\.]+$/.test(audioId) || audioId.includes("..")) {
              return new Response("Invalid audio ID", { status: 400 });
            }
            const audioFile = path.resolve(audioDir, audioId);
            if (!audioFile.startsWith(path.resolve(audioDir) + path.sep)) {
              return new Response("Access denied", { status: 403 });
            }

            try {
              const data = await fs.readFile(audioFile);
              const ext = path.extname(audioFile).toLowerCase();
              const audioMimes = {
                ".mp3": "audio/mpeg",
                ".wav": "audio/wav",
                ".ogg": "audio/ogg",
                ".m4a": "audio/mp4",
                ".webm": "audio/webm",
                ".aac": "audio/aac",
              };
              return new Response(data, {
                headers: {
                  "Content-Type": audioMimes[ext] || "audio/mpeg",
                  "Accept-Ranges": "bytes",
                  "Content-Security-Policy":
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' pacana: blob: data:; connect-src 'self' pacana: blob: data:; object-src 'none'; base-uri 'none'; frame-src 'none'",
                },
              });
            } catch {
              return new Response("Audio not found", { status: 404 });
            }
          }

          // Bundled app assets
          const asset = resolveAsset(root, request.url);
          if (!asset) return new Response("Not found", { status: 404 });

          const types = {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".webp": "image/webp",
            ".png": "image/png",
            ".ttf": "font/ttf",
            ".woff2": "font/woff2",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".m4a": "audio/mp4",
            ".webm": "audio/webm",
            ".aac": "audio/aac",
          };
          return new Response(await fs.readFile(asset), {
            headers: {
              "Content-Type":
                types[path.extname(asset).toLowerCase()] || "application/octet-stream",
              "Content-Security-Policy":
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' pacana: blob: data:; connect-src 'self' pacana: blob: data:; object-src 'none'; base-uri 'none'; frame-src 'none'",
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
          height: 35,
        },
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          backgroundThrottling: false,
          webSecurity: true,
        },
      });

      // IPC Handlers for Audio Persistence and Window Controls
      ipcMain.handle("audio:save", async (_event, { name, data, type }) => {
        const allowedTypes = [
          "audio/mpeg",
          "audio/wav",
          "audio/ogg",
          "audio/mp4",
          "audio/webm",
          "audio/aac",
          "audio/x-m4a",
        ];
        if (!allowedTypes.includes(type) && !type?.startsWith("audio/")) {
          throw new Error("Invalid audio file type. Please choose an MP3, WAV, OGG, or M4A file.");
        }

        const buf = Buffer.from(data);
        if (buf.length > 10 * 1024 * 1024) {
          throw new Error("Audio file must be under 10 MB.");
        }

        const extMap = {
          "audio/mpeg": ".mp3",
          "audio/wav": ".wav",
          "audio/ogg": ".ogg",
          "audio/mp4": ".m4a",
          "audio/webm": ".webm",
          "audio/aac": ".aac",
          "audio/x-m4a": ".m4a",
        };

        let ext = extMap[type] || path.extname(name || "").toLowerCase();
        if (!ext || !/^\.[a-z0-9]+$/.test(ext)) ext = ".mp3";

        const baseName = path.basename(name || "audio", ext).replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30);
        const id = `ringtone-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
        const targetPath = path.join(audioDir, id);

        await fs.mkdir(audioDir, { recursive: true });
        await fs.writeFile(targetPath, buf);

        return {
          id,
          url: `pacana://app/audio/${id}`,
          name: baseName + ext,
        };
      });

      ipcMain.handle("audio:delete", async (_event, id) => {
        if (!id || typeof id !== "string") return { success: false };
        let cleanId = id;
        if (cleanId.includes("/audio/")) {
          cleanId = cleanId.split("/audio/")[1];
        }
        if (!/^[a-zA-Z0-9_\-\.]+$/.test(cleanId) || cleanId.includes("..")) {
          return { success: false };
        }
        try {
          const targetPath = path.join(audioDir, cleanId);
          await fs.unlink(targetPath);
          return { success: true };
        } catch {
          return { success: false };
        }
      });

      ipcMain.handle("audio:url", (_event, id) => {
        let cleanId = id;
        if (cleanId.includes("/audio/")) {
          cleanId = cleanId.split("/audio/")[1];
        }
        return `pacana://app/audio/${cleanId}`;
      });

      ipcMain.handle("window:setFullscreen", (_event, flag) => {
        if (window && !window.isDestroyed()) {
          const target = Boolean(flag);
          window.setFullScreen(target);
          applyDesktopClasses(target);
          window.webContents.send("window:fullscreen-change", target);
          return target;
        }
        return false;
      });

      ipcMain.handle("window:isFullscreen", () => {
        return window && !window.isDestroyed() ? window.isFullScreen() : false;
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
        if (!smoke && !testFullscreen && savedState.isMaximized !== false) {
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

      const applyDesktopClasses = (explicitIsFull) => {
        if (!window || window.isDestroyed()) return;
        const isFull =
          typeof explicitIsFull === "boolean"
            ? explicitIsFull
            : window.isFullScreen();
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
      window.webContents.on("dom-ready", () => {
        applyDesktopClasses();
        window.webContents.send("window:fullscreen-change", window.isFullScreen());
      });
      window.on("enter-full-screen", () => {
        applyDesktopClasses(true);
        try {
          if (typeof window.setTitleBarOverlay === "function") {
            window.setTitleBarOverlay({ height: 0 });
          }
        } catch {}
        window.webContents.send("window:fullscreen-change", true);
      });
      window.on("leave-full-screen", () => {
        applyDesktopClasses(false);
        try {
          if (typeof window.setTitleBarOverlay === "function") {
            window.setTitleBarOverlay({
              color: "#f8f6ef",
              symbolColor: "#40372f",
              height: 35,
            });
          }
        } catch {}
        window.webContents.send("window:fullscreen-change", false);
      });

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
      if (testFullscreen) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const initialFs = window.isFullScreen();
          if (initialFs) throw new Error("Window unexpectedly started in fullscreen");

          // Click the fullscreen button in the UI
          await window.webContents.executeJavaScript(`
            (() => {
              const btn = document.querySelector('button[title*="fullscreen" i], button[aria-label*="fullscreen" i]');
              if (!btn) throw new Error('Fullscreen button not found in UI');
              btn.click();
            })()
          `);

          await new Promise((resolve) => setTimeout(resolve, 600));

          const inFsWindow = window.isFullScreen();
          if (!inFsWindow) throw new Error("Electron BrowserWindow.isFullScreen() was not true after click");

          const fsResult = await window.webContents.executeJavaScript(`
            (() => {
              const bodyHasClass = document.body.classList.contains('is-fullscreen');
              const fsTimer = document.querySelector('.fullscreen-timer');
              const fsTimerVisible = fsTimer ? window.getComputedStyle(fsTimer).display !== 'none' : false;
              const titlebar = document.querySelector('.desktop-titlebar');
              const titlebarHidden = titlebar ? window.getComputedStyle(titlebar).display === 'none' : true;
              return {
                bodyHasClass,
                fsTimerFound: !!fsTimer,
                fsTimerDisplay: fsTimer ? window.getComputedStyle(fsTimer).display : null,
                fsTimerVisible,
                titlebarHidden
              };
            })()
          `);

          if (!fsResult.bodyHasClass) throw new Error("Renderer document.body missing is-fullscreen class");
          if (!fsResult.fsTimerVisible) throw new Error("Fullscreen timer UI was not displayed");
          if (!fsResult.titlebarHidden) throw new Error("Desktop titlebar was not hidden in fullscreen");

          await fs.mkdir(path.join(process.cwd(), ".cache"), { recursive: true });
          await fs.writeFile(
            path.join(process.cwd(), ".cache/electron-fullscreen.png"),
            (await window.webContents.capturePage()).toPNG()
          );

          // Now test exit fullscreen via close button on FullscreenTimer
          await window.webContents.executeJavaScript(`
            (() => {
              const btn = document.querySelector('button[aria-label="Close fullscreen timer"], .fullscreen-header button');
              if (!btn) throw new Error('Close fullscreen timer button not found');
              btn.click();
            })()
          `);

          await new Promise((resolve) => setTimeout(resolve, 600));

          const exitedFsWindow = !window.isFullScreen();
          if (!exitedFsWindow) throw new Error("BrowserWindow did not exit fullscreen");

          const exitResult = await window.webContents.executeJavaScript(`
            (() => {
              const bodyNoClass = !document.body.classList.contains('is-fullscreen');
              const fsTimerClosed = document.querySelector('.fullscreen-timer') === null;
              const titlebar = document.querySelector('.desktop-titlebar');
              const titlebarVisible = titlebar ? window.getComputedStyle(titlebar).display !== 'none' : false;

              return {
                bodyNoClass,
                fsTimerClosed,
                titlebarVisible
              };
            })()
          `);

          if (!exitResult.bodyNoClass) throw new Error("Renderer still has is-fullscreen class after exit");
          if (!exitResult.fsTimerClosed) throw new Error("Fullscreen timer dialog did not close after exit");
          if (!exitResult.titlebarVisible) throw new Error("Desktop titlebar did not reappear after exit");

          await fs.writeFile(
            path.join(process.cwd(), ".cache/electron-restored.png"),
            (await window.webContents.capturePage()).toPNG()
          );

          console.log(JSON.stringify({
            success: true,
            enteredFullscreen: inFsWindow,
            rendererSynced: fsResult.bodyHasClass,
            companionActive: fsResult.companionVisible,
            titlebarHidden: fsResult.titlebarHidden,
            noFakeModal: fsResult.noModal,
            exitedFullscreen: exitedFsWindow,
            titlebarRestored: exitResult.titlebarVisible
          }));

          app.exit(0);
        } catch (error) {
          console.error("Fullscreen test failed:", error);
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
