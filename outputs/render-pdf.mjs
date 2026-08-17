// Растеризация PDF в PNG — чтобы посмотреть страницы глазами.
// В этой среде нет ни LibreOffice, ни poppler, поэтому рисуем через pdf.js
// на canvas и сохраняем картинки.

import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync } from "node:fs";

const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const file = process.argv[2];
const scale = Number(process.argv[3] ?? 1.4);
const only = process.argv[4] ? process.argv[4].split(",").map(Number) : null;

const data = new Uint8Array(readFileSync(file));
const pdf = await getDocument({ data, disableFontFace: true }).promise;

for (let n = 1; n <= pdf.numPages; n++) {
  if (only && !only.includes(n)) continue;
  const page = await pdf.getPage(n);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const out = `page-${String(n).padStart(2, "0")}.png`;
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(out, `${canvas.width}×${canvas.height}`);
}
