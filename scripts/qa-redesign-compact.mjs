import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/22073/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const baseUrl = process.env.WORKSTATION_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const view of ["today", "goals", "studio", "analytics", "knowledge", "canvas", "ai"]) {
    await page.goto(`${baseUrl}/#${view}`, { waitUntil: "networkidle" });
    const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert(width.scroll <= width.client + 1, `${view} 在 1280×720 下横向溢出`);
  }

  await page.goto(`${baseUrl}/#ai`, { waitUntil: "networkidle" });
  const input = page.locator(".agent-input");
  await input.scrollIntoViewIfNeeded();
  const inputBox = await input.boundingBox();
  assert(inputBox && inputBox.y + inputBox.height <= 720, "AI 输入框在 1280×720 下不可见");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ viewport: "1280x720", views: 7, aiInputVisible: true, runtimeErrors: errors }, null, 2));
} finally {
  await browser.close();
}
