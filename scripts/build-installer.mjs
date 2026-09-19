import { createWindowsInstaller } from "electron-winstaller";
import path from "node:path";
import { mkdir } from "node:fs/promises";

async function buildInstaller() {
  const outputDir = path.resolve("desktop-output/installer");
  await mkdir(outputDir, { recursive: true });
  console.log("Packaging Windows installer setup file (Pacana-Setup.exe)...");
  await createWindowsInstaller({
    appDirectory: path.resolve("desktop-output/Pacana-win32-x64"),
    outputDirectory: outputDir,
    authors: "razaele0003",
    exe: "Pacana.exe",
    setupExe: "Pacana-Setup.exe",
    setupIcon: path.resolve("desktop/icon.ico"),
    noMsi: true,
    description: "Pacana — Cozy Focus & Time Journal",
    title: "Pacana",
  });
  console.log("Installer created at: desktop-output/installer/Pacana-Setup.exe");
}

buildInstaller().catch((err) => {
  console.error("Installer build failed:", err);
  process.exit(1);
});
