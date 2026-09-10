const path = require("node:path");
function resolveAsset(root, raw) {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "pacana:" ||
      url.hostname !== "app" ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes("\\") || pathname.includes("\0")) return null;
    const asset = path.resolve(
      root,
      "." +
        (["/", "/app", "/app/"].includes(pathname) ? "/index.html" : pathname),
    );
    return asset.startsWith(path.resolve(root) + path.sep) ? asset : null;
  } catch {
    return null;
  }
}
module.exports = { resolveAsset };
