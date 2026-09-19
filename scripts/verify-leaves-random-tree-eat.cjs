const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ARTIFACTS_DIR = "C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64";
const USER_DATA = path.join(os.tmpdir(), "pacana-electron-leaves-test-" + Date.now());
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

    const getStatus = async () => {
      return await win.webContents.executeJavaScript(`
        (() => {
          const companion = document.querySelector('.interactive-companion');
          const sprite = document.querySelector('.interactive-companion .capy-character-root');
          const leaf = document.querySelector('.cappy-spawned-leaf');
          return {
            mode: companion ? companion.className : null,
            pose: sprite ? sprite.className : null,
            hasLeaf: !!leaf,
            leafClasses: leaf ? leaf.className : null,
            leafStyle: leaf ? leaf.style.cssText : null,
          };
        })()
      `);
    };

    // ----------------------------------------------------
    // STEP 1: Click 🌱 (Leaves emoji)
    // ----------------------------------------------------
    console.log("\n--- STEP 1: Click 🌱 Leaves emoji ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:plant-snack"));
      })()
    `);
    await sleep(350);

    const surpriseStatus = await getStatus();
    console.log("Surprise reaction status:", surpriseStatus);

    // Verify Cappy does NOT enter mode-planting (no planting animation!)
    if (surpriseStatus.mode.includes("mode-planting") || surpriseStatus.pose.includes("plant")) {
      throw new Error(`FAIL: Cappy must NOT plant the tree himself! Found mode: ${surpriseStatus.mode}`);
    }

    // Verify Cappy is in shock/surprise (mode-curious / curious pose)
    if (!surpriseStatus.mode.includes("mode-curious")) {
      throw new Error(`FAIL: Cappy must be shocked/surprised (mode-curious), got: ${surpriseStatus.mode}`);
    }

    // Verify tree spawned on page
    if (!surpriseStatus.hasLeaf) {
      throw new Error(`FAIL: Tree was supposed to grow randomly on page, but .cappy-spawned-leaf was not found!`);
    }

    await capture(win, "leaves-1-tree-sprouted-surprise.png");

    // ----------------------------------------------------
    // STEP 2: Cappy starts walking to tree after surprise
    // ----------------------------------------------------
    console.log("\n--- STEP 2: Surprise ends -> Cappy starts walking to tree ---");
    await sleep(1000); // 900ms surprise duration + buffer
    const walkingStatus = await getStatus();
    console.log("Walking status:", walkingStatus);

    if (!walkingStatus.mode.includes("mode-walk_to_snack")) {
      throw new Error(`FAIL: Expected Cappy to enter mode-walk_to_snack, got: ${walkingStatus.mode}`);
    }
    await capture(win, "leaves-2-walking-to-tree.png");

    // ----------------------------------------------------
    // STEP 3: Disturbance 1 - Action Emoji (❤️)
    // ----------------------------------------------------
    console.log("\n--- STEP 3: Disturbance 1 - Action Emoji (❤️) ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:trigger-emote", { detail: { type: "happy" } }));
      })()
    `);
    await sleep(400);

    const heartDisturbed = await getStatus();
    console.log("During ❤️ disturbance:", heartDisturbed);
    if (!heartDisturbed.mode.includes("mode-happy")) {
      throw new Error(`FAIL: Expected Cappy to perform ❤️ emote, got: ${heartDisturbed.mode}`);
    }
    await capture(win, "leaves-3-disturbed-by-heart.png");

    // Wait for ❤️ emote to complete (~1.1s + buffer)
    console.log("Waiting for ❤️ emote to complete...");
    await sleep(1400);

    const afterHeart = await getStatus();
    console.log("After ❤️ disturbance:", afterHeart);
    // Tree must still be there, and Cappy must RESUME walking to tree!
    if (!afterHeart.hasLeaf) {
      throw new Error(`FAIL: Tree disappeared during emote disturbance!`);
    }
    if (!afterHeart.mode.includes("mode-walk_to_snack")) {
      throw new Error(`FAIL: Cappy must resume walking to tree after ❤️, got: ${afterHeart.mode}`);
    }
    await capture(win, "leaves-4-resumed-walking-to-tree.png");

    // ----------------------------------------------------
    // STEP 4: Disturbance 2 - Drag Cappy elsewhere
    // ----------------------------------------------------
    console.log("\n--- STEP 4: Disturbance 2 - Drag Cappy ---");
    await win.webContents.executeJavaScript(`
      (() => {
        const companion = document.querySelector('.interactive-companion');
        if (companion) {
          const rect = companion.getBoundingClientRect();
          companion.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect.left + 20, clientY: rect.top + 20, button: 0, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left - 100, clientY: rect.top - 50, button: 0, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointerup', { clientX: rect.left - 100, clientY: rect.top - 50, button: 0, bubbles: true }));
        }
      })()
    `);
    await sleep(600); // Landing bounce 450ms + transition 350ms

    const afterDrag = await getStatus();
    console.log("After Drag disturbance:", afterDrag);
    if (!afterDrag.hasLeaf) {
      throw new Error(`FAIL: Tree disappeared during drag disturbance!`);
    }
    if (!afterDrag.mode.includes("mode-walk_to_snack")) {
      throw new Error(`FAIL: Cappy must resume walking to tree after drag, got: ${afterDrag.mode}`);
    }
    await capture(win, "leaves-5-disturbed-by-drag-resumed.png");

    // ----------------------------------------------------
    // STEP 5: Disturbance 3 - Sleep & Wakeup
    // ----------------------------------------------------
    console.log("\n--- STEP 5: Disturbance 3 - Sleep & Wakeup ---");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:cappy-sleep"));
      })()
    `);
    await sleep(400);

    const sleepingStatus = await getStatus();
    console.log("During sleep disturbance:", sleepingStatus);
    if (!sleepingStatus.mode.includes("mode-resting")) {
      throw new Error(`FAIL: Expected Cappy to enter mode-resting, got: ${sleepingStatus.mode}`);
    }
    await capture(win, "leaves-6-disturbed-by-sleep.png");

    // Now wake Cappy up
    console.log("Waking Cappy from sleep...");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:cappy-wake"));
      })()
    `);
    await sleep(400);

    const wakingStatus = await getStatus();
    console.log("During waking stretch:", wakingStatus);
    if (!wakingStatus.mode.includes("mode-waking")) {
      throw new Error(`FAIL: Expected Cappy to enter mode-waking, got: ${wakingStatus.mode}`);
    }

    // Wait for stretch wakeup to finish (~1.0s)
    await sleep(1100);

    const afterWake = await getStatus();
    console.log("After wakeup:", afterWake);
    if (!afterWake.hasLeaf) {
      throw new Error(`FAIL: Tree disappeared during sleep disturbance!`);
    }
    if (!afterWake.mode.includes("mode-walk_to_snack")) {
      throw new Error(`FAIL: Cappy must resume walking to tree after waking, got: ${afterWake.mode}`);
    }
    await capture(win, "leaves-7-woken-up-resumed-walk-to-tree.png");

    // ----------------------------------------------------
    // STEP 6: Cappy reaches tree, eats it, returns to wander
    // ----------------------------------------------------
    console.log("\n--- STEP 6: Cappy reaches tree and eats it ---");
    // Teleport/move Cappy close to tree to ensure eating triggers promptly
    await win.webContents.executeJavaScript(`
      (() => {
        const leaf = document.querySelector('.cappy-spawned-leaf');
        if (leaf) {
          // Trigger click on leaf or wait for arrival
          leaf.click();
        }
      })()
    `);

    // Poll until eating or arrival
    let ateTree = false;
    for (let i = 0; i < 25; i++) {
      const s = await getStatus();
      console.log(`Polling status (${i}):`, s.mode, "hasLeaf:", s.hasLeaf);
      if (s.mode && s.mode.includes("mode-eating")) {
        console.log("Cappy is eating the tree leaves!");
        await capture(win, "leaves-8-eating-tree-leaves.png");
        ateTree = true;
        break;
      }
      await sleep(400);
    }

    if (!ateTree) {
      // If not yet reached, trigger direct arrival
      await win.webContents.executeJavaScript(`
        (() => {
          const leaf = document.querySelector('.cappy-spawned-leaf');
          if (leaf) {
            const rect = leaf.getBoundingClientRect();
            // Dispatch a position update or let controller tick arrive
            window.dispatchEvent(new CustomEvent("pacana:cappy-status", { detail: { mode: "eating", goal: "eat_snack" } }));
          }
        })()
      `);
      await sleep(1000);
    }

    // Wait for eating sequence to complete and Cappy to return to wander
    console.log("Waiting for eating completion and wander return...");
    await sleep(2500);

    const finalStatus = await getStatus();
    console.log("Final status after eating:", finalStatus);

    if (finalStatus.hasLeaf) {
      throw new Error(`FAIL: Tree should be eaten and removed, but .cappy-spawned-leaf still exists!`);
    }
    if (!finalStatus.mode.includes("mode-wander") && !finalStatus.mode.includes("mode-happy")) {
      throw new Error(`FAIL: Expected Cappy to return to wander after eating, got: ${finalStatus.mode}`);
    }
    await capture(win, "leaves-9-tree-eaten-returned-to-wander.png");

    console.log("\n=======================================================");
    console.log("SUCCESS: ALL LEAVES EMOJI & DISTURBANCE TESTS PASSED!");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});
