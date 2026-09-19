const path = require("node:path");
const { spawn } = require("node:child_process");
const { app } = require("electron");

function checkSquirrelStartup() {
  if (process.platform !== "win32") return false;
  const cmd = process.argv[1];
  const target = path.basename(process.execPath);
  const updateExe = path.resolve(path.dirname(process.execPath), "..", "Update.exe");

  const run = (args) => {
    try {
      spawn(updateExe, args, { detached: true }).on("close", () => {
        app.quit();
      });
    } catch {
      app.quit();
    }
  };

  if (cmd === "--squirrel-install" || cmd === "--squirrel-updated") {
    run(["--createShortcut=" + target]);
    return true;
  }
  if (cmd === "--squirrel-uninstall") {
    run(["--removeShortcut=" + target]);
    return true;
  }
  if (cmd === "--squirrel-obsolete") {
    app.quit();
    return true;
  }
  return false;
}

module.exports = checkSquirrelStartup;
