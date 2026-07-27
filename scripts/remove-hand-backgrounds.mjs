import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const HAND_FILES = [
  "public/hands/hand-right.png",
  "public/hands/hand-right-1.png",
  "public/hands/hand-right-2.png",
  "public/hands/hand-right-3.png",
  "public/hands/hand-right-4.png",
  "public/hands/hand-right-5.png",
  "public/hands/hand-left.png",
  "public/hands/hand-left-1.png",
  "public/hands/hand-left-2.png",
  "public/hands/hand-left-3.png",
  "public/hands/hand-left-4.png",
  "public/hands/hand-left-5.png",
  "public/hands/hands-both.png",
  "public/hands/HAND-PIANOapp.png",
];

function crc32(buffer) {
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crc32.table[n] = c >>> 0;
    }
  }

  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crc32.table[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  return upDistance <= upLeftDistance ? up : upLeft;
}

function readPng(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${filePath}: not a PNG`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];
  const metadataChunks = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(Buffer.from(data));
    } else if (["gAMA", "cHRM", "sRGB", "iCCP"].includes(type)) {
      metadataChunks.push(pngChunk(type, Buffer.from(data)));
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(
      `${filePath}: expected 8-bit RGBA PNG, got bitDepth=${bitDepth} colorType=${colorType}`
    );
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let source = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source];
    source += 1;
    const rowStart = y * stride;
    const previousRowStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[source];
      source += 1;
      const left = x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[previousRowStart + x] : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel
          ? pixels[previousRowStart + x - bytesPerPixel]
          : 0;

      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upLeft);
      else throw new Error(`${filePath}: unsupported PNG row filter ${filter}`);

      pixels[rowStart + x] = value & 0xff;
    }
  }

  return { width, height, pixels, metadataChunks };
}

function writePng(filePath, png) {
  const { width, height, pixels, metadataChunks } = png;
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * height);
  let target = 0;

  for (let y = 0; y < height; y += 1) {
    raw[target] = 0;
    target += 1;
    pixels.copy(raw, target, y * stride, y * stride + stride);
    target += stride;
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  fs.writeFileSync(
    filePath,
    Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      pngChunk("IHDR", header),
      ...metadataChunks,
      pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      pngChunk("IEND"),
    ])
  );
}

function removeBorderWhite(png, threshold = 248) {
  const { width, height, pixels } = png;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  function isWhiteBackground(index) {
    const offset = index * 4;
    return (
      pixels[offset + 3] > 0 &&
      pixels[offset] >= threshold &&
      pixels[offset + 1] >= threshold &&
      pixels[offset + 2] >= threshold
    );
  }

  function push(index) {
    if (index < 0 || index >= pixelCount || visited[index] || !isWhiteBackground(index)) {
      return;
    }
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  }

  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const offset = index * 4;
    pixels[offset] = 255;
    pixels[offset + 1] = 255;
    pixels[offset + 2] = 255;
    pixels[offset + 3] = 0;

    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (index >= width) push(index - width);
    if (index < pixelCount - width) push(index + width);
  }

  return tail;
}

for (const relativePath of HAND_FILES) {
  const filePath = path.resolve(relativePath);
  const png = readPng(filePath);
  const removed = removeBorderWhite(png);
  writePng(filePath, png);
  console.log(`${relativePath}: made ${removed} border-background pixels transparent`);
}
