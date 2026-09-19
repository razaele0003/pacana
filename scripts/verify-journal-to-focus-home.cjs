const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ARTIFACTS_DIR = "C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64";
const USER_DATA = path.join(os.tmpdir(), "pacana-electron-tab-test-" + Date.now());
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

    // 2. Click "Let Capy wander" to undock Cappy and plant seed on cushion
    console.log("2. Clicking 'Let Capy wander'...");
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('.companion-wander-btn');
        if (btn) btn.click();
      })()
    `);
    await sleep(2500);

    // 3. Switch to the Journal tab (matching user screenshot)
    console.log("3. Switching to Journal tab...");
    await win.webContents.executeJavaScript(`
      (() => {
        const journalBtn = document.querySelector('button[data-tab="Journal"]');
        if (journalBtn) journalBtn.click();
      })()
    `);
    await sleep(1000);

    const onJournal = await win.webContents.executeJavaScript(`
      (() => {
        const activeTab = document.querySelector('.sidebar button.nav-item.active');
        return activeTab ? activeTab.getAttribute('data-tab') : null;
      })()
    `);
    console.log("Currently active tab:", onJournal);
    await capture(win, "tab-1-on-journal-with-floating-capy.png");

    if (onJournal !== "Journal") {
      throw new Error(`Expected active tab to be Journal, got ${onJournal}`);
    }

    // 4. Click the Home button while on Journal tab!
    console.log("4. Clicking Home button (dispatching pacana:call-cappy-home)...");
    await win.webContents.executeJavaScript(`
      (() => {
        window.dispatchEvent(new CustomEvent("pacana:call-cappy-home"));
      })()
    `);

    // 5. Cappy should walk to the Focus button in the sidebar and press it!
    console.log("5. Waiting for Cappy to walk to and press the Focus tab button...");
    let switchedToFocus = false;
    for (let i = 0; i < 25; i++) {
      await sleep(500);
      const curTab = await win.webContents.executeJavaScript(`
        (() => {
          const activeTab = document.querySelector('.sidebar button.nav-item.active');
          const companion = document.querySelector('.interactive-companion');
          return {
            tab: activeTab ? activeTab.getAttribute('data-tab') : null,
            mode: companion ? companion.className : null,
            transform: companion ? companion.style.transform : null,
          };
        })()
      `);
      console.log(`[t=${(i + 1) * 500}ms] Tab: ${curTab.tab}, Pos: ${curTab.transform}, Mode: ${curTab.mode}`);
      if (curTab.tab === "Focus") {
        switchedToFocus = true;
        await capture(win, "tab-2-switched-to-focus-tab.png");
        break;
      }
    }

    if (!switchedToFocus) {
      throw new Error("Expected Cappy to switch to the Focus tab!");
    }

    // 6. Now on Focus tab: Cappy sees the cushion tree, walks to it, eats it, and settles into idle!
    console.log("6. Waiting for Cappy to walk to cushion, eat leaves, and settle into idle...");
    let docked = false;
    for (let i = 0; i < 25; i++) {
      await sleep(600);
      const status = await win.webContents.executeJavaScript(`
        (() => {
          const companion = document.querySelector('.interactive-companion');
          const isDocked = companion ? companion.classList.contains('is-docked') : false;
          const burst = document.querySelector('.cushion-eating-burst');
          const tree = document.querySelector('.cushion-seed-art');
          return {
            isDocked,
            eating: !!burst,
            mode: companion ? companion.className : null,
            treeSrc: tree ? tree.getAttribute('src') : null,
          };
        })()
      `);
      console.log(`[t=${(i + 1) * 600}ms] Status:`, status);
      if (status.eating || (status.treeSrc && status.treeSrc.includes('tree-10.png'))) {
        await capture(win, "tab-3-eating-cushion-leaves.png");
      }
      if (status.isDocked) {
        docked = true;
        break;
      }
    }

    await sleep(800);
    const finalState = await win.webContents.executeJavaScript(`
      (() => {
        const root = document.querySelector('.interactive-companion.is-docked');
        const sprite = document.querySelector('.docked-companion-stage .capy-character-root');
        const tree = document.querySelector('.cushion-seed-art');
        return {
          isDocked: !!root,
          pose: sprite ? sprite.className : null,
          treeStillExists: !!tree,
        };
      })()
    `);
    console.log("Final State on Focus cushion:", finalState);
    await capture(win, "tab-4-settled-idle-on-focus-cushion.png");

    if (!finalState.isDocked) {
      throw new Error("Expected Cappy to be docked on cushion!");
    }
    if (finalState.treeStillExists) {
      throw new Error("Expected leaves/tree to be eaten and removed!");
    }

    console.log("\n========================================================");
    console.log("🎉 ALL JOURNAL -> FOCUS -> EAT -> IDLE TESTS PASSED!");
    console.log("========================================================\n");

    app.quit();
  } catch (err) {
    console.error("Test failed:", err);
    app.exit(1);
  }
});
