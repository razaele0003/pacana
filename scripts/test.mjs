import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["tests/core.test.ts", "tests/obstacle-manager.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: ".cache",
});
const result = spawnSync(
  process.execPath,
  ["--test", ".cache/core.test.js", ".cache/obstacle-manager.test.js"],
  {
    stdio: "inherit",
  }
);
process.exitCode = result.status ?? 1;

