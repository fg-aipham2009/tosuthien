#!/usr/bin/env node
/**
 * Convert post images under /data/images/posts to PNG via sharp.
 * jpg/jpeg/webp/gif -> png (same basename), then delete source.
 * Run: docker exec tosu_api node /data/_convert-post-images-png.mjs
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = process.env.POSTS_ROOT || "/data/images/posts";
const MIN_FREE_MB = Number(process.env.MIN_FREE_MB || 600);
const LEGACY = new Set([".jpg", ".jpeg", ".webp", ".gif", ".JPG", ".JPEG", ".WEBP", ".GIF"]);

function freeMb(dir) {
  const { freemem } = (() => {
    try {
      const st = fs.statfsSync ? fs.statfsSync(dir) : null;
      if (st) return { freemem: (st.bavail * st.bsize) / (1024 * 1024) };
    } catch {}
    // fallback parse df
    const { execSync } = require("child_process");
    const out = execSync(`df -m ${dir} | tail -1`).toString();
    const parts = out.trim().split(/\s+/);
    return { freemem: Number(parts[3]) };
  })();
  return freemem;
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (LEGACY.has(path.extname(name))) out.push(p);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(ROOT)) {
    console.error("Missing", ROOT);
    process.exit(1);
  }
  const files = walk(ROOT).sort();
  console.log(`to convert: ${files.length} under ${ROOT}`);
  let ok = 0,
    skip = 0,
    fail = 0;
  for (let i = 0; i < files.length; i++) {
    const src = files[i];
    const dst = src.replace(/\.(jpg|jpeg|webp|gif)$/i, ".png");
    const free = freeMb(ROOT);
    if (free < MIN_FREE_MB) {
      console.error(
        `STOP free=${free.toFixed(0)}MiB < ${MIN_FREE_MB}. ok=${ok} skip=${skip} fail=${fail} left=${files.length - i}`,
      );
      process.exit(2);
    }
    if (fs.existsSync(dst) && fs.statSync(dst).size > 0) {
      try {
        fs.unlinkSync(src);
      } catch {}
      skip++;
      continue;
    }
    try {
      await sharp(src).rotate().png({ compressionLevel: 9 }).toFile(dst);
      fs.unlinkSync(src);
      ok++;
    } catch (e) {
      fail++;
      console.error("FAIL", src, e.message || e);
      try {
        if (fs.existsSync(dst) && fs.statSync(dst).size === 0) fs.unlinkSync(dst);
      } catch {}
    }
    if ((i + 1) % 100 === 0 || i + 1 === files.length) {
      console.log(`[${i + 1}/${files.length}] ok=${ok} skip=${skip} fail=${fail} free=${free.toFixed(0)}MiB`);
    }
  }
  console.log(`Done ok=${ok} skip=${skip} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}

main();
