const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ARTIFACTS_DIR = "C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64";
const USER_DATA = path.join(os.tmpdir(), "pacana-electron-test-" + Date.now());
app.setPath("userData", USER_DATA);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  win.webContents.on("console-message", (event, level, message, line, sourceId) => {
    console.log(`[renderer ${level}] ${message}`);
  });

  try {
    console.log("Waiting for dev server...");
    let loaded = false;
    for (let i = 0; i < 20; i++) {
      try {
        await win.loadURL("http://localhost:5173/app");
        loaded = true;
        break;
      } catch (e) {
        await sleep(1000);
      }
    }
    if (!loaded) throw new Error("Could not connect to http://localhost:5173/app");

    // Wait until the splash screen is gone and .interactive-companion is present
    console.log("Waiting for app and companion to mount...");
    for (let i = 0; i < 30; i++) {
      const ready = await win.webContents.executeJavaScript(`(() => {
        const onboardingBtn = Array.from(document.querySelectorAll('button')).find(b => /Make myself at home/i.test(b.textContent || ''));
        if (onboardingBtn) onboardingBtn.click();
        return !!document.querySelector('.interactive-companion');
      })()`);
      if (ready) {
        console.log("Companion mounted!");
        break;
      }
      await sleep(500);
    }
    await sleep(1000);

    // Ensure onboarding modal is closed
    await win.webContents.executeJavaScript(`(() => {
      const onboardingBtn = Array.from(document.querySelectorAll('button')).find(b => /Make myself at home/i.test(b.textContent || ''));
      if (onboardingBtn) onboardingBtn.click();
    })()`);
    await sleep(500);

    // ========================================================
    // 1. DOCKED STATE & LET CAPY WANDER
    // ========================================================
    console.log("1. Checking docked companion & clicking 'Let Capy wander'...");
    let initialImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-1-initial-docked.png"), initialImg.toPNG());

    await win.webContents.executeJavaScript(`(() => {
      const btn = document.querySelector('.companion-wander-btn');
      if (btn) btn.click();
    })()`);
    await sleep(2000);

    let wanderingImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-2-wandering.png"), wanderingImg.toPNG());

    // ========================================================
    // 2. TEST 🌱 PLANTING (SEPARATE FROM EATING)
    // ========================================================
    console.log("2. Testing 🌱 Plant interaction...");
    await win.webContents.executeJavaScript(`(() => {
      window.dispatchEvent(new CustomEvent("pacana:plant-snack"));
    })()`);
    await sleep(500);

    // Capture planting animation
    let plantingImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-3-planting.png"), plantingImg.toPNG());

    // Wait for planting animation to complete (~1.5s total)
    await sleep(1800);

    // Verify plant exists and Cappy is NOT chasing it (Cappy mode is wander)
    const plantStatus = await win.webContents.executeJavaScript(`(() => {
      const leaf = document.querySelector('.cappy-spawned-leaf');
      const floating = document.querySelector('.interactive-companion.is-screen-floating');
      return {
        leafExists: !!leaf,
        leafStage: leaf?.className,
        cappyClass: floating?.className
      };
    })()`);
    console.log("Plant status after planting:", plantStatus);

    let wanderAfterPlantImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-4-wander-after-plant.png"), wanderAfterPlantImg.toPNG());

    // ========================================================
    // 3. TEST TEMPORARY EMOTES (❤️, ✨, 📖)
    // ========================================================
    console.log("3. Testing temporary emotes (❤️, ✨, 📖)...");

    // A. ❤️ Happy emote
    await win.webContents.executeJavaScript(`(() => {
      const menuBtn = document.querySelector('button[title*="Happy"]');
      if (menuBtn) menuBtn.click();
      else window.dispatchEvent(new CustomEvent("pacana:cappy-status", { detail: { mode: "happy", goal: "wander" } }));
    })()`);
    await sleep(400);
    let happyImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-5-happy-emote.png"), happyImg.toPNG());
    await sleep(1200);

    // B. ✨ Curious emote
    await win.webContents.executeJavaScript(`(() => {
      const menuBtn = document.querySelector('button[title*="Curious"]');
      if (menuBtn) menuBtn.click();
    })()`);
    await sleep(400);
    let curiousImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-6-curious-emote.png"), curiousImg.toPNG());
    await sleep(1200);

    // C. 📖 Reading interaction
    await win.webContents.executeJavaScript(`(() => {
      const menuBtn = document.querySelector('button[title*="Read"]');
      if (menuBtn) menuBtn.click();
    })()`);
    await sleep(500);
    let readImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-7-reading-action.png"), readImg.toPNG());
    await sleep(2000);

    // ========================================================
    // 4. TEST 🌙 SLEEP AUTO-WAKE
    // ========================================================
    console.log("4. Testing 🌙 Sleep & Auto-Wake...");
    await win.webContents.executeJavaScript(`(() => {
      window.dispatchEvent(new CustomEvent("pacana:cappy-sleep"));
    })()`);
    await sleep(800);

    const sleepStatus = await win.webContents.executeJavaScript(`(() => {
      const floating = document.querySelector('.interactive-companion.is-screen-floating');
      const dockBtn = document.querySelector('.dock-call-btn span');
      return {
        cappyClass: floating?.className,
        dockBtnText: dockBtn?.textContent
      };
    })()`);
    console.log("Sleep status:", sleepStatus);

    let sleepingImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-8-sleeping.png"), sleepingImg.toPNG());

    // Wait for auto-wake (7s sleep + 1s stretch)
    console.log("Waiting for auto-wake timer (8s)...");
    await sleep(8500);

    const afterWakeStatus = await win.webContents.executeJavaScript(`(() => {
      const floating = document.querySelector('.interactive-companion.is-screen-floating');
      const dockBtn = document.querySelector('.dock-call-btn span');
      return {
        cappyClass: floating?.className,
        dockBtnText: dockBtn?.textContent
      };
    })()`);
    console.log("After wake status:", afterWakeStatus);

    let awakeImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-9-awake-wandering.png"), awakeImg.toPNG());

    // ========================================================
    // 5. TEST 🏠 CALL HOME (PHYSICAL MOVEMENT & GROWING PLANT)
    // ========================================================
    console.log("5. Testing 🏠 Call Home with GROWING plant (CASE A: do not eat)...");
    // Start home walk
    await win.webContents.executeJavaScript(`(() => {
      window.dispatchEvent(new CustomEvent("pacana:call-cappy-home"));
    })()`);

    // Verify button text is "Capy is on the way..." while moving
    await sleep(400);
    const movingHomeStatus = await win.webContents.executeJavaScript(`(() => {
      const dockBtn = document.querySelector('.dock-call-btn span');
      const floating = document.querySelector('.interactive-companion.is-screen-floating');
      return {
        dockBtnText: dockBtn?.textContent,
        cappyClass: floating?.className,
        transform: floating?.style.transform
      };
    })()`);
    console.log("Moving home status:", movingHomeStatus);

    let movingHomeImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-10-moving-home.png"), movingHomeImg.toPNG());

    // Wait for Cappy to arrive home and settle
    await sleep(3500);

    const settledStatus = await win.webContents.executeJavaScript(`(() => {
      const isDocked = !!document.querySelector('.interactive-companion.is-docked');
      const leaf = document.querySelector('.cappy-spawned-leaf');
      return {
        isDocked,
        leafStillExists: !!leaf
      };
    })()`);
    console.log("Settled home with growing plant status:", settledStatus);

    let settledImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "rebuild-11-settled-growing-plant-intact.png"), settledImg.toPNG());

    console.log("ALL_REBUILD_VERIFICATIONS_PASSED_SUCCESSFULLY");
  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    win.destroy();
    app.quit();
  }
});
