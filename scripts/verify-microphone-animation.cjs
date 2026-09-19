const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ARTIFACTS_DIR = "C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64";
const USER_DATA = path.join(os.tmpdir(), "pacana-electron-mic-test-" + Date.now());
app.setPath("userData", USER_DATA);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(win, filename) {
  const image = await win.webContents.capturePage();
  const filePath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(filePath, image.toPNG());
  console.log(`[Captured] ${filename}`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    console.log("1. Navigating to http://localhost:5173/app ...");
    await win.loadURL("http://localhost:5173/app");
    await sleep(2000);

    // Dismiss welcome modal if present
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('.modal button.primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Make myself at home'));
        if (btn) btn.click();
      })()
    `);
    await sleep(1000);

    // Inspect initial docked Capy
    const initialPose = await win.webContents.executeJavaScript(`
      (() => {
        const root = document.querySelector('.docked-companion-stage .capy-character-root');
        return root ? root.className : 'NONE';
      })()
    `);
    console.log("Initial docked pose:", initialPose);

    // 2. Trigger pacana:timer-complete with 2.5s sound
    console.log("2. Triggering pacana:timer-complete with 2500ms sound...");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:sound-started", { detail: { durationMs: 2500 } }));
        window.dispatchEvent(new CustomEvent("pacana:timer-complete", { detail: { timerId: "timer-test-1", phase: "focus" } }));
      })()
    `);

    // 3. Wait 400ms: animation should be in progress around frame 3-4
    await sleep(400);
    const midInfo = await win.webContents.executeJavaScript(`
      (() => {
        const vp = document.querySelector('.docked-companion-stage .capy-sprite-viewport');
        const img = document.querySelector('.docked-companion-stage .capy-spritesheet-image');
        return {
          viewportExists: !!vp,
          overflow: vp ? window.getComputedStyle(vp).overflow : null,
          transform: img ? img.style.transform : null,
          width: img ? img.style.width : null,
          src: img ? img.getAttribute('src') : null,
        };
      })()
    `);
    console.log("Mid-animation info:", JSON.stringify(midInfo, null, 2));
    await capture(win, "mic-1-animation-mid.png");

    if (!midInfo.viewportExists) {
      throw new Error("Sprite sheet viewport not found!");
    }
    if (midInfo.overflow !== "hidden") {
      throw new Error("Expected overflow: hidden on sprite viewport!");
    }

    // 4. Wait until 1200ms: frames 1->7 done (7 * 125ms = 875ms), but sound (2500ms) still playing!
    // Must hold Frame 7!
    await sleep(800);
    const holdInfo = await win.webContents.executeJavaScript(`
      (() => {
        const img = document.querySelector('.docked-companion-stage .capy-spritesheet-image');
        return {
          transform: img ? img.style.transform : null,
        };
      })()
    `);
    console.log("Hold Frame 7 info:", JSON.stringify(holdInfo, null, 2));
    await capture(win, "mic-2-holding-frame7.png");

    if (!holdInfo.transform || !holdInfo.transform.includes("-85.714")) {
      throw new Error(`Expected holding Frame 7 (-85.7143%), got ${holdInfo.transform}`);
    }

    // 5. Simulate sound ended
    console.log("5. Sound finishes -> dispatching pacana:sound-ended...");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:sound-ended"));
      })()
    `);

    await sleep(400);
    const endInfo = await win.webContents.executeJavaScript(`
      (() => {
        const root = document.querySelector('.docked-companion-stage .capy-character-root');
        const img = document.querySelector('.docked-companion-stage .capy-spritesheet-image');
        return {
          className: root ? root.className : 'NONE',
          sheetExists: !!img,
        };
      })()
    `);
    console.log("After sound ended info:", JSON.stringify(endInfo, null, 2));
    await capture(win, "mic-3-returned-to-idle.png");

    if (endInfo.sheetExists) {
      throw new Error("Expected sprite sheet to clean up after sound ended!");
    }

    // 6. Test Floating Cappy
    console.log("6. Testing Floating Cappy microphone animation...");
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('.companion-wander-btn');
        if (btn) btn.click();
      })()
    `);
    // Wait for getting-up planting sequence to complete (~1.8s)
    await sleep(2500);

    // Trigger timer complete for floating
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:sound-started", { detail: { durationMs: 1800 } }));
        window.dispatchEvent(new CustomEvent("pacana:timer-complete", { detail: { timerId: "timer-test-2", phase: "focus" } }));
      })()
    `);

    await sleep(500);
    const floatingMid = await win.webContents.executeJavaScript(`
      (() => {
        const img = document.querySelector('.interactive-companion.is-screen-floating .capy-spritesheet-image');
        return {
          exists: !!img,
          transform: img ? img.style.transform : null,
        };
      })()
    `);
    console.log("Floating Cappy mid-animation:", JSON.stringify(floatingMid, null, 2));
    await capture(win, "mic-4-floating-mid.png");

    if (!floatingMid.exists) {
      throw new Error("Floating Cappy sprite sheet image not found!");
    }

    // Floating sound ended
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:sound-ended"));
      })()
    `);
    await sleep(500);

    const floatingEnd = await win.webContents.executeJavaScript(`
      (() => {
        const companion = document.querySelector('.interactive-companion.is-screen-floating');
        const img = document.querySelector('.interactive-companion.is-screen-floating .capy-spritesheet-image');
        return {
          companionClass: companion ? companion.className : 'NONE',
          sheetExists: !!img,
        };
      })()
    `);
    console.log("Floating Cappy after sound ended:", JSON.stringify(floatingEnd, null, 2));
    await capture(win, "mic-5-floating-returned-to-wander.png");

    if (floatingEnd.sheetExists) {
      throw new Error("Expected floating sprite sheet to clean up after sound ended!");
    }

    console.log("\n========================================================");
    console.log("🎉 ALL MICROPHONE ANIMATION & AUDIO SYNC TESTS PASSED!");
    console.log("========================================================\n");

    app.quit();
  } catch (err) {
    console.error("Verification failed:", err);
    app.exit(1);
  }
});
