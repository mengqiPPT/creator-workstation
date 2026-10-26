import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/22073/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const outputRoot =
  "C:/Users/22073/.codex/visualizations/2026/08/01/019fbe12-ab5c-7c90-8e5e-795651684cc6";
const exportPath = `${outputRoot}/creator-workstation.canvas`;
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

try {
  const context = await browser.newContext({
    acceptDownloads: true,
    colorScheme: "light",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto("http://127.0.0.1:5173/#canvas", {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: /先把关系摆出来/ }).waitFor();
  await page.getByRole("button", { name: "创建空白便签" }).click();
  await page.getByLabel("标题").fill("内容选题地图");
  await page
    .getByLabel("正文")
    .fill("从用户问题出发，连接素材、脚本和发布渠道。 ");

  await page.locator(".canvas-source-item").first().click();
  await page.locator(".react-flow__node").nth(1).waitFor();
  assert.equal(await page.locator(".react-flow__node").count(), 2);

  const firstSource = page
    .locator(".react-flow__node")
    .nth(0)
    .locator(".react-flow__handle-right");
  const secondTarget = page
    .locator(".react-flow__node")
    .nth(1)
    .locator(".react-flow__handle-left");
  const sourceBox = await firstSource.boundingBox();
  const targetBox = await secondTarget.boundingBox();
  assert(sourceBox && targetBox, "连接点应当可见");
  await firstSource.hover({ force: true });
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + 40, sourceBox.y + sourceBox.height / 2, {
    steps: 5,
  });
  await secondTarget.hover({ force: true });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.locator(".react-flow__edge").waitFor();

  await page.locator(".react-flow__pane").click({ position: { x: 70, y: 500 } });
  await page.screenshot({
    path: `${outputRoot}/workstation-canvas-light.png`,
    fullPage: true,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 .canvas" }).click();
  const download = await downloadPromise;
  await download.saveAs(exportPath);
  const exported = JSON.parse(await fs.readFile(exportPath, "utf8"));
  assert.equal(exported.nodes.length, 2);
  assert.equal(exported.edges.length, 1);
  assert(exported.nodes.every((node) => node.id && node.width && node.height));

  const savedBeforeReload = await page.evaluate(() =>
    localStorage.getItem("workstation.canvas.v1"),
  );
  assert(savedBeforeReload, "画布应保存到本机存储");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("内容选题地图", { exact: true }).waitFor();
  await page.locator(".canvas-file-input").setInputFiles(exportPath);
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".react-flow__node").count(), 2);
  assert.equal(await page.locator(".react-flow__edge").count(), 1);

  await page.locator(".topbar-actions button").last().click();
  await page.screenshot({
    path: `${outputRoot}/workstation-canvas-dark.png`,
    fullPage: true,
  });

  const mobileContext = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://127.0.0.1:5173/#canvas", {
    waitUntil: "networkidle",
  });
  await mobilePage.getByRole("button", { name: "创建空白便签" }).click();
  await mobilePage.getByLabel("标题").fill("移动端灵感便签");
  const mobileNodeBox = await mobilePage.locator(".react-flow__node").boundingBox();
  const mobileStageBox = await mobilePage.locator(".canvas-stage").boundingBox();
  assert(mobileNodeBox && mobileStageBox, "移动端卡片和画布应当可见");
  assert(mobileNodeBox.x >= mobileStageBox.x);
  assert(mobileNodeBox.x + mobileNodeBox.width <= mobileStageBox.x + mobileStageBox.width);
  await mobilePage.locator(".react-flow__pane").click({
    position: { x: 40, y: 420 },
  });
  await mobilePage.screenshot({
    path: `${outputRoot}/workstation-canvas-mobile.png`,
    fullPage: true,
  });
  await mobileContext.close();

  assert.deepEqual(runtimeErrors, []);
  console.log(
    JSON.stringify(
      {
        nodes: exported.nodes.length,
        edges: exported.edges.length,
        reloadPersisted: true,
        runtimeErrors,
        screenshots: [
          "workstation-canvas-light.png",
          "workstation-canvas-dark.png",
          "workstation-canvas-mobile.png",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
