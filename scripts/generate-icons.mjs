// Generuje ikony PNG z public/icons/icon.svg (Chromium headless z Playwright).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icons/icon.svg", "utf8");
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
const shots = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/apple-touch-icon.png", 180, 0],
  ["public/icons/icon-maskable-512.png", 512, 0.1],
];
for (const [path, size, pad] of shots) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<html><body style="margin:0;background:#0e100f;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</body></html>`);
  await page.screenshot({ path, omitBackground: false });
}
await browser.close();
console.log("Ikony wygenerowane.");
