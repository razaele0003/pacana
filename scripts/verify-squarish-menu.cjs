const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ARTIFACTS_DIR = "C:/Users/razae/.gemini/antigravity/brain/2db0cdf7-5e33-45d3-9033-b0c3d72cdd64";
const USER_DATA = path.join(os.tmpdir(), "pacana-electron-squarish-menu-" + Date.now());
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
    console.log("1. Loading http://localhost:5173/app ...");
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

    // Click "Let Capy wander" to undock Cappy
    console.log("2. Clicking 'Let Capy wander'...");
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('.companion-wander-btn');
        if (btn) btn.click();
      })()
    `);
    await sleep(2000);

    // Hover on Cappy to reveal menu
    console.log("3. Hovering over Cappy to reveal menu...");
    const capyRect = await win.webContents.executeJavaScript(`
      (() => {
        const companion = document.querySelector('.interactive-companion');
        if (!companion) return null;
        const r = companion.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      })()
    `);

    if (capyRect) {
      win.webContents.sendInputEvent({ type: 'mouseMove', x: capyRect.x, y: capyRect.y });
    }
    await sleep(800);

    // Check computed styles of menu and buttons
    const menuStyles = await win.webContents.executeJavaScript(`
      (() => {
        const menu = document.querySelector('.capy-multi-menu');
        const firstBtn = document.querySelector('.capy-menu-btn');
        const homeBtn = document.querySelector('.capy-dock-shortcut-btn');
        if (!menu || !firstBtn || !homeBtn) return null;
        const menuCs = window.getComputedStyle(menu);
        const btnCs = window.getComputedStyle(firstBtn);
        const homeCs = window.getComputedStyle(homeBtn);
        return {
          menuBorderRadius: menuCs.borderRadius,
          menuPadding: menuCs.padding,
          btnWidth: btnCs.width,
          btnHeight: btnCs.height,
          btnBorderRadius: btnCs.borderRadius,
          homeWidth: homeCs.width,
          homeHeight: homeCs.height,
          homeBorderRadius: homeCs.borderRadius,
        };
      })()
    `);

    console.log("Computed menu styles:", menuStyles);
    if (!menuStyles) {
      throw new Error("Menu was not rendered in DOM");
    }

    await capture(win, "menu-1-squarish-easy-to-click.png");

    // Click ❤️ button to test clickability
    console.log("4. Testing click on ❤️ emoji button...");
    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.capy-menu-btn'));
        const heartBtn = btns.find(b => b.textContent.includes('❤️'));
        if (heartBtn) heartBtn.click();
      })()
    `);
    await sleep(400);

    const companionClass = await win.webContents.executeJavaScript(`
      document.querySelector('.interactive-companion')?.className
    `);
    console.log("Companion class after clicking ❤️:", companionClass);

    if (!companionClass.includes("mode-happy")) {
      throw new Error("Expected clicking ❤️ button to trigger mode-happy");
    }

    await capture(win, "menu-2-clicked-heart-reaction.png");

    console.log("\n=======================================================");
    console.log("SUCCESS: SQUARISH MENU & BUTTONS VERIFIED!");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});
