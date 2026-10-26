import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/22073/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const outputRoot =
  "C:/Users/22073/.codex/visualizations/2026/08/01/019fbe12-ab5c-7c90-8e5e-795651684cc6";
const exportPath = `${outputRoot}/creator-workstation-template.canvas`;
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

  await page.goto("http://127.0.0.1:5173/#canvas", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("workstation.canvas.v1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "选择画布模板" }).click();
  await page.getByRole("heading", { name: "选择第一张真实画布" }).waitFor();
  await page.screenshot({
    path: `${outputRoot}/workstation-canvas-template-picker.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: /内容项目流/ }).click();
  await page.getByText("已创建“内容项目流”实验画布。请用真实内容替换模板文字。", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "选择第一张真实画布" }).waitFor({ state: "hidden" });
  assert.equal(await page.locator(".react-flow__node").count(), 6);
  assert.equal(await page.locator(".react-flow__edge").count(), 5);
  await page.getByText("灵感来源", { exact: true }).waitFor();
  await page.getByText("发布后复盘", { exact: true }).waitFor();
  await page.waitForTimeout(350);
  const saved = await page.evaluate(() => localStorage.getItem("workstation.canvas.v1"));
  assert(saved?.includes("内容项目流") === false);
  assert(saved?.includes("灵感来源"));

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "更多画布操作" }).click();
  await page.getByRole("menuitem", { name: "导出 Canvas" }).click();
  const download = await downloadPromise;
  await download.saveAs(exportPath);
  const exported = JSON.parse(await fs.readFile(exportPath, "utf8"));
  assert.equal(exported.nodes.length, 6);
  assert.equal(exported.edges.length, 5);

  await page.getByRole("button", { name: "模板", exact: true }).click();
  await page.getByText("新模板会添加到当前画布右侧，不会清空已有卡片。", { exact: true }).waitFor();
  await page.getByRole("button", { name: /项目拆解/ }).click();
  await page.getByText("已把“项目拆解”添加到当前画布右侧，原有卡片保持不变。", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "选择第一张真实画布" }).waitFor({ state: "hidden" });
  assert.equal(await page.locator(".react-flow__node").count(), 10);
  assert.equal(await page.locator(".react-flow__edge").count(), 9);
  assert.equal(await page.getByText("灵感来源", { exact: true }).count(), 1);

  await page.screenshot({
    path: `${outputRoot}/workstation-canvas-template-light.png`,
    fullPage: true,
  });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".react-flow__node").count(), 10);
  assert.equal(await page.locator(".react-flow__edge").count(), 9);

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("workstation.ui.v1") ?? "{}");
    localStorage.setItem("workstation.ui.v1", JSON.stringify({ ...state, darkMode: true }));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({
    path: `${outputRoot}/workstation-canvas-template-dark.png`,
    fullPage: true,
  });

  const mobileContext = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://127.0.0.1:5173/#canvas", { waitUntil: "networkidle" });
  await mobilePage.getByRole("button", { name: "选择画布模板" }).click();
  await mobilePage.getByRole("button", { name: /选题决策/ }).click();
  await mobilePage.getByText("已创建“选题决策”实验画布。请用真实内容替换模板文字。", { exact: true }).waitFor();
  assert.equal(await mobilePage.locator(".react-flow__node").count(), 5);
  assert.equal(await mobilePage.locator(".react-flow__edge").count(), 5);
  const viewportWidth = await mobilePage.evaluate(() => window.innerWidth);
  const documentWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  assert(documentWidth <= viewportWidth + 1, "移动端不应产生页面级横向滚动");
  await mobilePage.screenshot({
    path: `${outputRoot}/workstation-canvas-template-mobile.png`,
    fullPage: true,
  });
  await mobileContext.close();

  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({
    templateCreated: true,
    existingCanvasPreservedOnAdd: true,
    jsonCanvasExportVerified: true,
    reloadPersisted: true,
    mobileOverflowFree: true,
    nodesAfterAppend: 10,
    edgesAfterAppend: 9,
    runtimeErrors,
    screenshots: [
      "workstation-canvas-template-picker.png",
      "workstation-canvas-template-light.png",
      "workstation-canvas-template-dark.png",
      "workstation-canvas-template-mobile.png",
    ],
  }, null, 2));
} finally {
  await browser.close();
}
