const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ARTIFACTS_DIR = "C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64";
const USER_DATA = path.join(os.tmpdir(), "pacana-electron-emoji-test-" + Date.now());
app.setPath("userData", USER_DATA);

app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");

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
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  try {
    console.log("1. Navigating to http://localhost:5173/app ...");
    await win.loadURL("http://localhost:5173/app");
    await sleep(2000);

    // Dismiss welcome modal
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('.modal button.primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Make myself at home'));
        if (btn) btn.click();
      })()
    `);
    await sleep(1000);

    // 2. Click "Let Capy wander" to undock Cappy
    console.log("2. Clicking 'Let Capy wander'...");
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('.companion-wander-btn');
        if (btn) btn.click();
      })()
    `);
    await sleep(2000);

    // Helper to get Cappy state
    const getState = async () => {
      return await win.webContents.executeJavaScript(`
        (() => {
          const companion = document.querySelector('.interactive-companion');
          const sprite = document.querySelector('.interactive-companion .capy-character-root');
          return {
            mode: companion ? companion.className : null,
            pose: sprite ? sprite.className : null,
          };
        })()
      `);
    };

    // ----------------------------------------------------
    // TEST 1: ❤️ Happy emote -> performs -> returns to wander
    // ----------------------------------------------------
    console.log("\n--- TEST 1: ❤️ Happy emote ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:trigger-emote", { detail: { type: "happy" } }));
      })()
    `);
    await sleep(400);
    const happyState = await getState();
    console.log("During Happy:", happyState);
    if (!happyState.mode.includes("mode-happy")) {
      throw new Error(`Expected Cappy to enter mode-happy, got ${happyState.mode}`);
    }
    await capture(win, "emoji-1-happy.png");

    // Wait for happy animation to complete (~1.1s + buffer)
    await sleep(1300);
    const afterHappy = await getState();
    console.log("After Happy:", afterHappy);
    if (!afterHappy.mode.includes("mode-wander")) {
      throw new Error(`Expected Cappy to return to wander after ❤️, got ${afterHappy.mode}`);
    }

    // ----------------------------------------------------
    // TEST 2: ✨ Curious emote -> performs -> returns to wander
    // ----------------------------------------------------
    console.log("\n--- TEST 2: ✨ Curious emote ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:trigger-emote", { detail: { type: "curious" } }));
      })()
    `);
    await sleep(400);
    const curiousState = await getState();
    console.log("During Curious:", curiousState);
    if (!curiousState.mode.includes("mode-curious")) {
      throw new Error(`Expected Cappy to enter mode-curious, got ${curiousState.mode}`);
    }
    await capture(win, "emoji-2-curious.png");

    await sleep(1300);
    const afterCurious = await getState();
    console.log("After Curious:", afterCurious);
    if (!afterCurious.mode.includes("mode-wander")) {
      throw new Error(`Expected Cappy to return to wander after ✨, got ${afterCurious.mode}`);
    }

    // ----------------------------------------------------
    // TEST 3: 📖 Reading emote -> performs -> returns to wander
    // ----------------------------------------------------
    console.log("\n--- TEST 3: 📖 Reading emote ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:trigger-emote", { detail: { type: "reading" } }));
      })()
    `);
    await sleep(400);
    const readState = await getState();
    console.log("During Reading:", readState);
    if (!readState.mode.includes("mode-reading")) {
      throw new Error(`Expected Cappy to enter mode-reading, got ${readState.mode}`);
    }
    await capture(win, "emoji-3-reading.png");

    await sleep(2100);
    const afterRead = await getState();
    console.log("After Reading:", afterRead);
    if (!afterRead.mode.includes("mode-wander")) {
      throw new Error(`Expected Cappy to return to wander after 📖, got ${afterRead.mode}`);
    }

    // ----------------------------------------------------
    // TEST 4: 🌱 Planting action -> performs -> returns to wander
    // ----------------------------------------------------
    console.log("\n--- TEST 4: 🌱 Planting action ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:plant-snack"));
      })()
    `);
    await sleep(400);
    const plantState = await getState();
    console.log("During Planting:", plantState);
    if (!plantState.mode.includes("mode-planting")) {
      throw new Error(`Expected Cappy to enter mode-planting, got ${plantState.mode}`);
    }
    await capture(win, "emoji-4-planting.png");

    // Wait for planting animation (~1.0s) + celebration (~0.8s) + buffer
    await sleep(2200);
    const afterPlant = await getState();
    console.log("After Planting:", afterPlant);
    if (!afterPlant.mode.includes("mode-wander")) {
      throw new Error(`Expected Cappy to return to wander after 🌱, got ${afterPlant.mode}`);
    }

    // ----------------------------------------------------
    // TEST 5: 🌙 Sleeping -> stays sleeping indefinitely until disturbed
    // ----------------------------------------------------
    console.log("\n--- TEST 5: 🌙 Sleeping (remains sleeping indefinitely) ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:cappy-sleep"));
      })()
    `);
    await sleep(400);
    const sleepingState = await getState();
    console.log("Sleeping state:", sleepingState);
    await capture(win, "emoji-5-sleeping.png");
    if (!sleepingState.mode.includes("mode-resting")) {
      throw new Error(`Expected Cappy to enter mode-resting, got ${sleepingState.mode}`);
    }

    // Wait 3 seconds - verify he REMAINS sleeping (no auto-wake timer)
    console.log("Waiting 3s to verify Cappy remains sleeping...");
    await sleep(3000);
    const stillSleeping = await getState();
    console.log("Still Sleeping at t=3s:", stillSleeping);
    if (!stillSleeping.mode.includes("mode-resting")) {
      throw new Error(`Expected Cappy to remain sleeping, but woke up!`);
    }

    // ----------------------------------------------------
    // TEST 6: Disturb sleep by CLICK -> wakes and returns to wander
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Disturb sleep by CLICK ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:cappy-wake"));
      })()
    `);
    await sleep(400);
    const wakingState = await getState();
    console.log("Waking state (stretch):", wakingState);
    await capture(win, "emoji-6-waking-stretch.png");

    await sleep(1300);
    const afterWake = await getState();
    console.log("After wake (returned to wander):", afterWake);
    if (!afterWake.mode.includes("mode-wander")) {
      throw new Error(`Expected Cappy to return to wander after wake, got ${afterWake.mode}`);
    }

    // ----------------------------------------------------
    // TEST 7: Put to sleep -> disturb by other action emoji (❤️)
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Disturb sleep by another action emoji (❤️) ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:cappy-sleep"));
      })()
    `);
    await sleep(500);
    console.log("Sleeping again:", await getState());

    // Click ❤️ while sleeping
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:trigger-emote", { detail: { type: "happy" } }));
      })()
    `);
    await sleep(400);
    const happyFromSleep = await getState();
    console.log("Woken by ❤️ (in happy emote):", happyFromSleep);
    if (!happyFromSleep.mode.includes("mode-happy")) {
      throw new Error(`Expected Cappy to wake and enter mode-happy, got ${happyFromSleep.mode}`);
    }
    await capture(win, "emoji-7-woken-by-heart.png");

    await sleep(1400);
    const afterHappyFromSleep = await getState();
    console.log("After happy from sleep (returned to wander):", afterHappyFromSleep);
    if (!afterHappyFromSleep.mode.includes("mode-wander")) {
      throw new Error(`Expected Cappy to return to wander, got ${afterHappyFromSleep.mode}`);
    }

    // ----------------------------------------------------
    // TEST 8: Put to sleep -> disturb by DRAG
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Disturb sleep by DRAG ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:cappy-sleep"));
      })()
    `);
    await sleep(500);
    console.log("Sleeping before drag:", await getState());

    // Simulate drag
    await win.webContents.executeJavaScript(`
      (() => {
        const companion = document.querySelector('.interactive-companion');
        if (companion) {
          const r = companion.getBoundingClientRect();
          companion.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: r.left + 20,
            clientY: r.top + 20,
          }));
          window.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true,
            clientX: r.left + 80,
            clientY: r.top + 80,
          }));
        }
      })()
    `);
    await sleep(300);
    const dragDisturbed = await getState();
    console.log("During drag disturbance:", dragDisturbed);
    await capture(win, "emoji-8-woken-by-drag.png");

    // Release drag
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
        }));
      })()
    `);
    await sleep(900);
    const afterDrag = await getState();
    console.log("After drag release (returned to wander):", afterDrag);
    if (!afterDrag.mode.includes("mode-wander")) {
      throw new Error(`Expected Cappy to return to wander after drag release, got ${afterDrag.mode}`);
    }

    console.log("\n========================================================");
    console.log("🎉 ALL EMOJI ACTION & SLEEP DISTURBANCE TESTS PASSED!");
    console.log("========================================================\n");

    app.quit();
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
});
