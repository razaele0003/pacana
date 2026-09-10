# Pacana for Windows — local preview

Double-click `Start-Pacana.cmd` in the project root, or launch `desktop-output/Pacana-win32-x64/Pacana.exe`. Keep the whole output folder together; the executable needs its accompanying runtime files.

This preview bundles the application and artwork. It does not load the published website or require a development server or internet connection. Minimize the window to keep the timer running. Closing the app quits it; reminders are not delivered while it is closed. Reopening reconciles elapsed time without inventing sessions.

Desktop data is stored separately under `%APPDATA%/Pacana-Desktop`. To bring your browser journal over, export a backup in the browser and restore it in desktop Settings. Restore replaces the desktop journal after confirmation. Nothing is uploaded or synchronized.

## Local development

- `npm run build:vercel` builds the shared renderer locally (does not publish).
- `npm run desktop` opens the local Electron app after building.
- `npm run desktop:check` checks asset-path restrictions.
- `npm run desktop:smoke` opens an isolated test profile, verifies the renderer and IndexedDB across reload, saves `.cache/desktop-smoke.png`, then exits.
- `npm run desktop:package` creates the Windows x64 folder. No publishing or signing is performed.

If your npm installation blocks Electron's download script, run `node node_modules/electron/install.js` once before launching locally.

The preview is unsigned, has no installer or automatic updater, and stays local until explicitly released. Electron's sandbox and context isolation are enabled, Node is unavailable to the renderer, and navigation is restricted to bundled app content. Notifications are enabled only through the existing user-controlled setting.
