#!/usr/bin/env node
// Writes build/icon.ico from the helm pixel map: `npm run icon`.
// Every size is a whole-pixel scale of the 16x16 map, so nothing gets blurred.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pixels } = require('../src/main/icon');

const SCALES = [1, 2, 3, 4, 16]; // 16, 32, 48, 64, 256 px

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(scale) {
  const size = 16 * scale;
  const rgba = pixels(scale);
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // leading 0 = no filter
    rgba.copy(row, 1, y * size * 4, (y + 1) * size * 4);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// An .ico is a small directory followed by the images; PNG images are fine since Vista.
const images = SCALES.map(png);
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((img, i) => {
  const size = 16 * SCALES[i];
  const e = 6 + 16 * i;
  header[e] = size % 256; // 0 means 256
  header[e + 1] = size % 256;
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(img.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += img.length;
});

const out = path.join(__dirname, '..', 'build', 'icon.ico');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, ...images]));
console.log(`Wrote ${out}`);
