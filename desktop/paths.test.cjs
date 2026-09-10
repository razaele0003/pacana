const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { resolveAsset } = require("./paths.cjs");
const root = path.resolve("dist/vercel");
test("desktop serves only bundled app files", () => {
  assert.equal(
    resolveAsset(root, "pacana://app/app"),
    path.join(root, "index.html"),
  );
  assert.equal(
    resolveAsset(root, "pacana://app/assets/app.js"),
    path.join(root, "assets/app.js"),
  );
  for (const url of [
    "https://example.com/",
    "pacana://other/app",
    "pacana://app/%2e%2e%2fsecret",
    "pacana://app/%5csecret",
    "pacana://app/%00",
    "pacana://user:pass@app/app",
  ])
    assert.equal(resolveAsset(root, url), null);
});
