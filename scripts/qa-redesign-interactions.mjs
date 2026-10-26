import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/22073/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const baseUrl = process.env.WORKSTATION_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${baseUrl}/#canvas`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("workstation.canvas.v1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "创建空白便签", exact: true }).click();
  const node = page.locator(".react-flow__node").first();
  await node.click();
  const before = await node.evaluate((element) => ({ width: Number.parseFloat(getComputedStyle(element).width), height: Number.parseFloat(getComputedStyle(element).height) }));
  const handle = page.locator(".canvas-manual-resizer");
  const handleBox = await handle.boundingBox();
  assert(handleBox, "找不到卡片右下角缩放手柄");
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 130, startY + 90, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const after = await node.evaluate((element) => ({ width: Number.parseFloat(getComputedStyle(element).width), height: Number.parseFloat(getComputedStyle(element).height) }));
  assert(after.width > before.width + 60, "鼠标拖拽没有改变卡片宽度");
  assert(after.height > before.height + 40, "鼠标拖拽没有改变卡片高度");

  await page.goto(`${baseUrl}/#ai`, { waitUntil: "networkidle" });
  const textarea = page.locator(".agent-input textarea");
  await textarea.focus();
  await textarea.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "输" }));
  });
  await textarea.fill("输入中文时不要发送");
  await textarea.press("Enter");
  await textarea.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "入" }));
  });
  assert((await textarea.inputValue()).includes("输入中文时不要发送"), "中文组合输入期间 Enter 清空或发送了内容");
  assert.equal(await page.locator(".agent-message.user").count(), 0, "中文组合输入期间错误发送了消息");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ canvasDragResize: { before, after }, imeCompositionPreserved: true, runtimeErrors: errors }, null, 2));
} finally {
  await browser.close();
}
