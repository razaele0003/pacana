import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = process.argv[2] || "dist/client";
async function walk(dir) {
  const result = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) result.push(...(await walk(p)));
    else result.push(p);
  }
  return result;
}
const files = (await walk(root)).filter(
  (p) => /\.(js|css|woff2?|ttf|webp|svg|png)$/.test(p) && !p.endsWith("/sw.js"),
);
const hash = createHash("sha256");
for (const path of files) hash.update(await readFile(path));
const version = `pacana-${hash.digest("hex").slice(0, 12)}`;
const sw = `const CACHE=${JSON.stringify(version)};const ASSETS=${JSON.stringify(files.map((p) => p.slice(root.length)))};
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);for(const path of ['/','/app']){try{const r=await fetch(path);if(r.ok&&!r.redirected)await cache.put(path,r);}catch{}}await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('pacana-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin)return;if(event.request.mode==='navigate'){event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const r=await fetch(event.request);if(r.ok&&!r.redirected)await cache.put(url.pathname,r.clone());return r;}catch{return await cache.match(url.pathname)||await cache.match('/app')||Response.error();}})());return;}if(ASSETS.includes(url.pathname))event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(url.pathname)||fetch(event.request);})());});`;
await writeFile(`${root}/sw.js`, sw);
console.log(`Offline cache: ${files.length} assets, ${version}`);
