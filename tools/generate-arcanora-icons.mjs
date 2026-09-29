// Raster companions to apps/web/public/icons/arcanora-emblem.svg.
// Uses only Node built-ins so icon generation stays reproducible in the repository.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'public', 'icons');
const palette = { bg: [16, 23, 25], stone: [68, 76, 73], stoneLight: [129, 113, 84], ward: [88, 183, 173], inner: [19, 43, 45], flame: [239, 135, 43], light: [255, 218, 134] };
const inside = (x, y, points) => {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
};
const line = (x, y, ax, ay, bx, by, width) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= width;
};
const shield = [[.5,.24],[.71,.34],[.69,.62],[.5,.82],[.31,.62],[.29,.34]];
const shieldInner = [[.5,.28],[.67,.36],[.65,.60],[.5,.77],[.35,.60],[.33,.36]];
const flame = [[.5,.37],[.47,.47],[.40,.55],[.41,.65],[.46,.71],[.53,.72],[.59,.68],[.62,.58],[.56,.49],[.56,.41],[.52,.49]];
const heart = [[.51,.55],[.47,.61],[.47,.67],[.52,.69],[.56,.65],[.55,.61]];
const cracks = [[.30,.35,.43,.42],[.43,.42,.49,.38],[.70,.36,.57,.46],[.57,.46,.61,.55],[.33,.61,.42,.56],[.42,.56,.48,.64],[.66,.64,.57,.59]];
function color(x, y) {
  const r = Math.hypot(x - .5, y - .45);
  let c = palette.bg;
  if (r < .48) c = [22 + Math.round((.48-r)*16), 32 + Math.round((.48-r)*14), 33 + Math.round((.48-r)*10)];
  const archOuter = y > .16 && y < .88 && x > .13 && x < .87 && (y > .43 || Math.hypot((x-.5)/.37, (y-.43)/.31) < 1);
  const archInner = y > .27 && y < .9 && x > .23 && x < .77 && (y > .43 || Math.hypot((x-.5)/.27, (y-.43)/.20) < 1);
  if (archOuter && !archInner) c = palette.stone;
  if (archOuter && !archInner && (x < .16 || x > .84 || y < .19)) c = palette.stoneLight;
  if (y > .85 && y < .89 && x > .12 && x < .88) c = palette.stoneLight;
  if (inside(x,y,shield)) c = palette.ward;
  if (inside(x,y,shieldInner)) c = palette.inner;
  for (const [ax,ay,bx,by] of cracks) if (line(x,y,ax,ay,bx,by,.006)) c = palette.ward;
  if (inside(x,y,flame)) c = palette.flame;
  if (inside(x,y,heart)) c = palette.light;
  return c;
}
const crcTable = Array.from({length: 256}, (_, index) => {
  let c = index;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buffer) { let c = -1; for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(Buffer.concat([name,data])));
  return Buffer.concat([length,name,data,checksum]);
}
function png(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const offsets = [-.25,.25];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sum = [0,0,0];
      for (const oy of offsets) for (const ox of offsets) {
        const c = color((px+.5+ox)/size,(py+.5+oy)/size);
        for (let k=0;k<3;k++) sum[k] += c[k];
      }
      const base = py*stride+1+px*4;
      for (let k=0;k<3;k++) raw[base+k] = Math.round(sum[k]/4);
      raw[base+3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size,0); header.writeUInt32BE(size,4); header[8]=8; header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
for (const size of [32,180,192,512]) writeFileSync(join(root, `arcanora-${size}.png`),png(size));
