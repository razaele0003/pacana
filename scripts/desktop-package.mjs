import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { packager } from "@electron/packager";
const root = path.resolve(".cache/desktop-stage");
await mkdir(root, { recursive: true });
await cp("desktop", path.join(root, "desktop"), { recursive: true });
await cp("dist/vercel", path.join(root, "dist/vercel"), { recursive: true });

// Ensure runtime dependencies are included in package stage
const stageNodeModules = path.join(root, "node_modules");
await mkdir(stageNodeModules, { recursive: true });
try {
  await cp("node_modules/electron-squirrel-startup", path.join(stageNodeModules, "electron-squirrel-startup"), { recursive: true });
  await cp("node_modules/debug", path.join(stageNodeModules, "debug"), { recursive: true });
  await cp("node_modules/ms", path.join(stageNodeModules, "ms"), { recursive: true });
} catch (e) {
  console.warn("Notice: could not copy optional squirrel node_modules, using desktop/squirrel-startup.cjs fallback", e.message);
}

const pkg = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile("package.json", "utf8"),
);

await writeFile(
  path.join(root, "package.json"),
  JSON.stringify({
    name: "pacana",
    productName: "Pacana",
    version: pkg.version || "0.1.3",
    main: "desktop/main.cjs",
  }),
);
const outputs = await packager({
  dir: root,
  out: "desktop-output",
  name: "Pacana",
  icon: path.resolve("desktop/icon.ico"),
  platform: "win32",
  arch: "x64",
  overwrite: true,
  asar: true,
  prune: false,
  electronVersion: JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile("node_modules/electron/package.json", "utf8"),
  ).version,
});
console.log(outputs.join("\n"));
