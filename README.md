# Pacana

Cozy Focus & Time Journal. A local-first React/TypeScript application on the Sites vinext starter.

## Development

Requires Node.js 22.13+.

```sh
npm run install:ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

The development app is at http://localhost:5173/app. `npm start` serves the production Worker locally. Building also generates a versioned service worker with all application bundles, fonts, and optimized artwork.

On Windows, if the npm command shim fails, invoke the installed npm JavaScript entrypoint with Node. This machine required `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run build`.

## Architecture

- `core/`: timestamp-based Pomodoro, distinct clock/elapsed schedules, checkpoint reconciliation, XP and statistics.
- `data/`: atomic IndexedDB transactions and validated version-1 backup/restore. Schema upgrades belong in the database upgrade transaction; unsupported backup versions fail without replacing current data.
- `adapters/`: optional sound/notifications and browser lifecycle/offline integration.
- `components/`: accessible React interface and landing page.
- `styles/`: reusable visual tokens and responsive layout.

IndexedDB read/write transactions serialize updates across tabs. Reconciliation is idempotent, rewards are keyed by source event, and saves are validated before committing. Recovery processes at most 500 missed checkpoints per transaction and continues on subsequent ticks.

Clock schedules select the next strictly future local occurrence and never backfill before activation. Start Now preserves its exact activation timestamp. DST gaps are skipped; repeated local times emit once. Statistics group completed sessions by their completion date in the selected timezone; journal activity is never added to measured focus time.

## Data and browser limits

No application account, backend journal, telemetry, or synchronization. Each browser origin has its own journal: localhost data does not automatically transfer to the deployed URL. Use Settings → Export backup, then import on the destination. Restoring replaces existing data only after confirmation.

Keep the browser open for timely reminders. Service workers cache the application for offline reopening but do not provide guaranteed closed-browser alarms. After suspended timers expire, only the current phase completes; continuing is explicit. Device-clock changes affect timestamp-based scheduling.

## Art

Built-in ChatGPT image generation created the UI concept board, forest scene, and four-pose capybara sheet. Original PNGs and optimized WebP assets are included. The actual interface uses semantic HTML, CSS, and Lucide icons. Nunito fonts are hosted locally for offline use.

See `design/ARTWORK.md` and `tests/ACCEPTANCE.md` for generation prompts and verification evidence.

## Scope

V1 includes focus/break timing, Clock Schedule, Start Now, pending checkpoints, journal editing, daily/weekly progress, XP, settings, backup/restore, optional notifications, offline caching, and responsive layouts. Native apps, downloads, accounts, cloud sync, leaderboards, and purchases are intentionally absent.
