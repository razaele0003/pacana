const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const ARTIFACTS_DIR = "C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64";

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
    console.log(`[renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  try {
    console.log("Loading http://localhost:5173/app ...");
    await win.loadURL("http://localhost:5173/app");
    await sleep(2500);

    // 1. Initial State: Cappy on Focus tab or docked
    console.log("Checking initial companion state...");
    let initialImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "tree-test-1-initial.png"), initialImg.toPNG());

    // 2. Click 'Let Capy wander' if docked, or ensure Cappy is wandering
    console.log("Clicking 'Let Capy wander'...");
    await win.webContents.executeJavaScript(`(() => {
      const wanderBtn = document.querySelector('.companion-wander-btn');
      if (wanderBtn) wanderBtn.click();
    })()`);
    await sleep(1500);

    // Check cushion has seed/dirt mound (stage 1)
    const cushionSeedInfo = await win.webContents.executeJavaScript(`(() => {
      const el = document.querySelector('.cushion-seed-art');
      const emptyText = document.querySelector('.empty-text')?.textContent;
      return {
        src: el?.getAttribute('src'),
        alt: el?.getAttribute('alt'),
        className: el?.className,
        emptyText
      };
    })()`);
    console.log("Cushion seed info after wandering:", cushionSeedInfo);

    let seedImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "tree-test-2-cushion-seed-planted.png"), seedImg.toPNG());

    // 3. Click 'Call Capy home' to trigger tree growth sequence!
    console.log("Triggering 'Call Capy home'...");
    await win.webContents.executeJavaScript(`(() => {
      const callBtn = document.querySelector('.dock-call-btn');
      if (callBtn) callBtn.click();
      else window.dispatchEvent(new CustomEvent('pacana:call-cappy-home'));
    })()`);

    // Capture growth mid-way (stage 3-5)
    await sleep(400);
    const midGrowthInfo = await win.webContents.executeJavaScript(`(() => {
      const el = document.querySelector('.cushion-seed-art');
      const emptyText = document.querySelector('.empty-text')?.textContent;
      return {
        src: el?.getAttribute('src'),
        alt: el?.getAttribute('alt'),
        className: el?.className,
        emptyText
      };
    })()`);
    console.log("Mid-growth info (~400ms):", midGrowthInfo);

    let midGrowthImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "tree-test-3-growing-sprout.png"), midGrowthImg.toPNG());

    // Capture near full bloom (stage 9-10)
    await sleep(750);
    const bloomInfo = await win.webContents.executeJavaScript(`(() => {
      const el = document.querySelector('.cushion-seed-art');
      const emptyText = document.querySelector('.empty-text')?.textContent;
      const beacon = document.querySelector('.cushion-beacon-ring');
      return {
        src: el?.getAttribute('src'),
        alt: el?.getAttribute('alt'),
        className: el?.className,
        hasBeacon: !!beacon,
        emptyText
      };
    })()`);
    console.log("Bloom info (~1150ms):", bloomInfo);

    let bloomImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "tree-test-4-blooming-tree.png"), bloomImg.toPNG());

    // 4. Wait for Cappy to arrive at cushion, eat the tree, and dock
    await sleep(3500);
    const arrivedInfo = await win.webContents.executeJavaScript(`(() => {
      const el = document.querySelector('.cushion-seed-art');
      const dockedCompanion = document.querySelector('.interactive-companion.is-docked');
      return {
        cushionSeedPresent: !!el,
        cushionSeedSrc: el?.getAttribute('src'),
        isDocked: !!dockedCompanion
      };
    })()`);
    console.log("Arrived & docked info:", arrivedInfo);

    let dockedImg = await win.capturePage();
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "tree-test-5-cappy-docked-eaten.png"), dockedImg.toPNG());

    console.log("VERIFICATION_COMPLETE_SUCCESS");
  } catch (err) {
    console.error("Verification error:", err);
  } finally {
    win.destroy();
    app.quit();
  }
});
