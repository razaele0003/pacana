# Pacana V1 acceptance evidence

Verified 2026-09-10.

## Automated

`npm test`: 16 tests covering strict-future activation, first/subsequent logged periods, exact Start Now anchors, pause/reload serialization, abandonment, suspended recovery, cycle/auto-start behavior, DST gaps/folds, midnight/timezone changes, concurrent modes, reward idempotency/rounding, malformed backup rejection, concurrent IndexedDB writes, rollback of invalid writes, backup/restore round-trip, and notification denial/unsupported browser fallback.

`npm run typecheck`: passes.
`npm run lint`: passes.
`npm run build`: passes, including versioned offline precache generation.

## Live browser

Used an isolated production-build origin (127.0.0.1:4173); preserved the user's journal on localhost:5173.

- Onboarding and custom timer setup worked.
- Started a real one-minute focus session, paused at 00:55, reloaded, and verified it remained paused at 00:55.
- Resumed and completed that session: one completed record, one measured minute, exactly 1 XP.
- Ran a one-minute Start Now schedule concurrently and saved a reflection: total became 6 XP.
- Opened a second tab; session, checkpoint, and reward records remained shared without duplicates.
- Activated a clock schedule after its configured start; next checkpoint was the next minute, without historical backfill. First period displayed the actual partial minute.
- Stopped the test server and successfully reloaded /app and navigated to / from the service-worker cache; journal and artwork remained available.
- Checked Focus and check-in forms at measured viewport widths 374 (stricter than 375), 768, and 1440; no horizontal overflow. Inspected mobile/desktop visuals, including companion poses.
- Exported a real JSON backup successfully. Live import was blocked by the Chrome extension's disabled file-URL access; restore validation/round-trip passed in automated tests. Manual import remains the browser acceptance limitation.

## Boundaries

Actual operating-system sleep/wake and notification delivery were not simulated through OS controls; timestamp recovery and permission fallback are covered in deterministic tests. Closed-browser alarms are intentionally not guaranteed. Statistics assign a completed session to its completion date in the selected timezone. Cloud syncing and native apps are out of scope.
