import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { packager } from "@electron/packager";
const root = path.resolve(".cache/desktop-stage");
await mkdir(root, { recursive: true });
await cp("desktop", path.join(root, "desktop"), { recursive: true });
await cp("dist/vercel", path.join(root, "dist/vercel"), { recursive: true });
await writeFile(
  path.join(root, "package.json"),
  JSON.stringify({
    name: "pacana",
    productName: "Pacana",
    version: "0.1.0",
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
