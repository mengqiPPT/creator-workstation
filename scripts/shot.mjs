import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/22073/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const baseUrl = process.env.WORKSTATION_URL ?? "http://127.0.0.1:5173";
const outDir = process.env.SHOT_DIR ?? ".workbuddy/shots";
const views = (process.env.SHOT_VIEWS ?? "today,goals,studio,analytics,knowledge,canvas,ai").split(",");
const scheme = process.env.SHOT_SCHEME ?? "light";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const errors = [];
try {
  const context = await browser.newContext({
    colorScheme: scheme,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  if (scheme === "dark") {
    await page.goto(`${baseUrl}/#today`, { waitUntil: "networkidle" });
    await page.evaluate(() =>
      localStorage.setItem("workstation.ui.v1", JSON.stringify({ darkMode: true, view: "today" })),
    );
  }

  for (const view of views) {
    await page.goto(`${baseUrl}/#${view}`, { waitUntil: "networkidle" });
    await page.locator("#main-content").waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${outDir}/${scheme}-${view}.png`, fullPage: true });
  }

  console.log(JSON.stringify({ scheme, views, errors }, null, 2));
} finally {
  await browser.close();
}
