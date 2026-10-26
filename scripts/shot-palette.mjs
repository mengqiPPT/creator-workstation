import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/22073/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const baseUrl = process.env.WORKSTATION_URL ?? "http://127.0.0.1:5173";
const outDir = ".workbuddy/shots";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

try {
  const context = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/#today`, { waitUntil: "networkidle" });
  await page.locator("#main-content").waitFor();
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${outDir}/palette-open.png`, fullPage: false });

  await page.keyboard.type("知识");
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/palette-query.png`, fullPage: false });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const el = document.querySelector(".topbar-search");
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/palette-from-button.png`, fullPage: false });

  console.log("ok");
} finally {
  await browser.close();
}
