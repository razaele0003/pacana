const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ARTIFACTS_DIR = "C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64";
const USER_DATA = path.join(os.tmpdir(), "pacana-electron-eat-test-" + Date.now());
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

    // Check that tree is on the cushion
    const treeInfo = await win.webContents.executeJavaScript(`
      (() => {
        const tree = document.querySelector('.cushion-seed-art');
        const callBtn = document.querySelector('.docked-actions .dock-call-btn');
        return {
          treeExists: !!tree,
          treeSrc: tree ? tree.getAttribute('src') : null,
          callBtnText: callBtn ? callBtn.textContent.trim() : null,
        };
      })()
    `);
    console.log("Tree on cushion info:", treeInfo);
    await capture(win, "eat-1-cushion-tree-growing.png");

    if (!treeInfo.treeExists) {
      throw new Error("Expected tree to exist on cushion!");
    }

    // 3. Click "Call Capy home"
    console.log("3. Clicking 'Call Capy home'...");
    await win.webContents.executeJavaScript(`
      (() => {
        const callBtn = document.querySelector('.docked-actions .dock-call-btn');
        if (callBtn) callBtn.click();
      })()
    `);

    // 4. Wait for Cappy to walk to the cushion and eat leaves
    console.log("4. Waiting for Cappy to arrive at cushion and eat leaves...");
    let docked = false;
    for (let i = 0; i < 20; i++) {
      await sleep(600);
      const status = await win.webContents.executeJavaScript(`
        (() => {
          const companion = document.querySelector('.interactive-companion');
          const isDocked = companion ? companion.classList.contains('is-docked') : false;
          const burst = document.querySelector('.cushion-eating-burst');
          return {
            isDocked,
            eating: !!burst,
            mode: companion ? companion.className : null,
          };
        })()
      `);
      console.log(`[t=${(i + 1) * 600}ms] Status:`, status);
      if (status.eating) {
        await capture(win, "eat-2-cappy-eating-leaves.png");
      }
      if (status.isDocked) {
        docked = true;
        break;
      }
    }

    // 5. Final verification after docking
    await sleep(800);
    const finalDockedInfo = await win.webContents.executeJavaScript(`
      (() => {
        const root = document.querySelector('.interactive-companion.is-docked');
        const sprite = document.querySelector('.docked-companion-stage .capy-character-root');
        const tree = document.querySelector('.cushion-seed-art');
        return {
          isDocked: !!root,
          poseClass: sprite ? sprite.className : null,
          treeStillExists: !!tree,
        };
      })()
    `);
    console.log("Final docked info (should be docked, pose-idle, no tree):", finalDockedInfo);
    await capture(win, "eat-3-settled-idle-on-cushion.png");

    if (!finalDockedInfo.isDocked) {
      throw new Error("Expected Cappy to be docked on cushion!");
    }
    if (finalDockedInfo.treeStillExists) {
      throw new Error("Expected leaves/tree to be eaten and removed!");
    }

    console.log("\n========================================================");
    console.log("🎉 CALL CAPY HOME & EAT LEAVES TEST PASSED SUCCESSFULLY!");
    console.log("========================================================\n");

    app.quit();
  } catch (err) {
    console.error("Test failed:", err);
    app.exit(1);
  }
});
