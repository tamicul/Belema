import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const inPath = process.argv[2];
const outPath = process.argv[3];
if(!inPath || !outPath){
  console.error('usage: node extract_belema_mark.mjs <in.png> <out.png>');
  process.exit(2);
}

function isBg(r,g,b,a){
  if(a === 0) return true;
  // treat near-white as background
  return r > 248 && g > 248 && b > 248;
}

const buf = fs.readFileSync(inPath);
const png = PNG.sync.read(buf);

let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
for(let y=0; y<png.height; y++){
  for(let x=0; x<png.width; x++){
    const idx = (png.width*y + x) << 2;
    const r = png.data[idx], g = png.data[idx+1], b = png.data[idx+2], a = png.data[idx+3];
    if(!isBg(r,g,b,a)){
      if(x < minX) minX = x;
      if(y < minY) minY = y;
      if(x > maxX) maxX = x;
      if(y > maxY) maxY = y;
    }
  }
}

if(maxX < 0){
  console.error('no non-background pixels found');
  process.exit(1);
}

// Add padding
const pad = Math.round(Math.min(png.width, png.height) * 0.03);
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(png.width - 1, maxX + pad);
maxY = Math.min(png.height - 1, maxY + pad);

// Heuristic: if the bounding box includes the wordmark, cut it off.
// We assume the mark is in the upper portion. If bbox is very tall, keep the top ~70%.
const h = maxY - minY + 1;
if(h > png.height * 0.7){
  maxY = Math.round(png.height * 0.68);
}

const w = maxX - minX + 1;
const out = new PNG({ width: w, height: maxY - minY + 1 });
for(let y=0; y<out.height; y++){
  for(let x=0; x<out.width; x++){
    const srcIdx = ((png.width*(y+minY) + (x+minX)) << 2);
    const dstIdx = ((out.width*y + x) << 2);
    out.data[dstIdx] = png.data[srcIdx];
    out.data[dstIdx+1] = png.data[srcIdx+1];
    out.data[dstIdx+2] = png.data[srcIdx+2];
    out.data[dstIdx+3] = png.data[srcIdx+3];
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log(`wrote ${outPath} (${out.width}x${out.height})`);
