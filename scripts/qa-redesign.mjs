import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/22073/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const baseUrl = process.env.WORKSTATION_URL ?? "http://127.0.0.1:5173";
const outputRoot =
  "C:/Users/22073/.codex/visualizations/2026/08/01/019fbe12-ab5c-7c90-8e5e-795651684cc6";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

const runtimeErrors = [];

try {
  const context = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  async function open(view) {
    await page.goto(`${baseUrl}/#${view}`, { waitUntil: "networkidle" });
    await page.locator("#main-content").waitFor();
    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert(overflow.content <= overflow.viewport + 1, `${view} 页面出现横向溢出`);
  }

  await open("today");
  await page.screenshot({ path: `${outputRoot}/workstation-v060-today.png`, fullPage: true });

  await open("goals");
  await page.screenshot({ path: `${outputRoot}/workstation-v060-goals.png`, fullPage: true });

  await open("studio");
  await page.screenshot({ path: `${outputRoot}/workstation-v060-studio.png`, fullPage: true });

  await open("analytics");
  await page.screenshot({ path: `${outputRoot}/workstation-v060-review.png`, fullPage: true });

  await open("knowledge");
  await page.screenshot({ path: `${outputRoot}/workstation-v060-knowledge.png`, fullPage: true });

  await open("ai");
  await page.screenshot({ path: `${outputRoot}/workstation-v060-ai.png`, fullPage: true });

  await open("canvas");
  await page.evaluate(() => localStorage.removeItem("workstation.canvas.v1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "模板", exact: true }).click();
  await page.locator(".canvas-template-option").first().click();
  await page.locator(".react-flow__node").first().click();
  await page.getByRole("button", { name: "宽幅", exact: true }).click();
  await page.getByRole("button", { name: "整理", exact: true }).click();
  await page.waitForTimeout(350);

  const selectedBox = await page.locator(".react-flow__node.selected").boundingBox();
  const selectedLayoutWidth = await page.locator(".react-flow__node.selected").evaluate((node) => Number.parseFloat(getComputedStyle(node).width));
  assert(selectedBox && selectedLayoutWidth >= 470, "宽幅尺寸没有应用到选中卡片");
  const panelLayout = await page.evaluate(() => {
    const stage = document.querySelector(".canvas-stage")?.getBoundingClientRect();
    const flow = document.querySelector(".canvas-stage .react-flow")?.getBoundingClientRect();
    const inspector = document.querySelector(".canvas-inspector")?.getBoundingClientRect();
    const selected = document.querySelector(".react-flow__node.selected")?.getBoundingClientRect();
    return stage && flow && inspector && selected
      ? {
          stageWidth: stage.width,
          flowWidth: flow.width,
          flowLeft: flow.left,
          flowRight: flow.right,
          inspectorLeft: inspector.left,
          selectedLeft: selected.left,
          selectedRight: selected.right,
        }
      : null;
  });
  assert(panelLayout, "画布编辑器布局信息缺失");
  assert(panelLayout.flowWidth < panelLayout.stageWidth - 300, "编辑器打开后没有为画布预留独立空间");
  assert(panelLayout.flowRight <= panelLayout.inspectorLeft - 8, "编辑器仍然遮挡画布视口");
  assert(panelLayout.selectedLeft >= panelLayout.flowLeft - 1 && panelLayout.selectedRight <= panelLayout.flowRight + 1, "选中卡片被画布视口裁切");
  const resizeHandles = await page.locator(".canvas-manual-resizer").count();
  assert.equal(resizeHandles, 1, "选中卡片没有显示清晰的缩放抓手");
  const navOverflow = await page.locator(".sidebar").evaluate((sidebar) => sidebar.scrollWidth - sidebar.clientWidth);
  assert(navOverflow <= 1, "画布窄导航出现横向文字溢出");
  const overlappingPairs = await page.locator(".react-flow__node").evaluateAll((nodes) => {
    const boxes = nodes.map((node) => node.getBoundingClientRect());
    let overlaps = 0;
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        if (boxes[left].left < boxes[right].right && boxes[left].right > boxes[right].left && boxes[left].top < boxes[right].bottom && boxes[left].bottom > boxes[right].top) overlaps += 1;
      }
    }
    return overlaps;
  });
  assert.equal(overlappingPairs, 0, "自动整理后卡片发生重叠");
  await page.screenshot({ path: `${outputRoot}/workstation-v060-canvas.png`, fullPage: true });

  await page.waitForTimeout(350);
  const savedWideWidth = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("workstation.canvas.v1") ?? "{}");
    const widths = (saved.nodes ?? []).map((node) => Number(node.style?.width ?? 0));
    return Math.max(0, ...widths);
  });
  assert(savedWideWidth >= 470, "卡片缩放尺寸没有写入本机存储");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".react-flow__node").first().waitFor();
  await page.waitForTimeout(500);
  const persistedCanvas = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("workstation.canvas.v1") ?? "{}");
    const dom = [...document.querySelectorAll(".react-flow__node")].map((node) => ({
      id: node.getAttribute("data-id"),
      inlineWidth: node.style.width,
      computedWidth: Number.parseFloat(getComputedStyle(node).width),
    }));
    return {
      storedWidths: (saved.nodes ?? []).map((node) => Number(node.style?.width ?? 0)),
      dom,
    };
  });
  const persistedWideWidth = Math.max(0, ...persistedCanvas.dom.map((node) => node.computedWidth));
  assert(persistedWideWidth >= 470, `卡片缩放尺寸在重载后没有保留：${JSON.stringify(persistedCanvas)}`);

  await page.evaluate(() => localStorage.setItem("workstation.ui.v1", JSON.stringify({ darkMode: true, view: "today" })));
  await page.reload({ waitUntil: "networkidle" });
  await open("today");
  await page.locator(".app-shell.dark").waitFor();
  await page.screenshot({ path: `${outputRoot}/workstation-v060-dark-today.png`, fullPage: true });

  await open("ai");
  await page.locator(".app-shell.dark").waitFor();
  await page.screenshot({ path: `${outputRoot}/workstation-v060-dark-ai.png`, fullPage: true });

  await open("canvas");
  await page.locator(".app-shell.dark").waitFor();
  await page.screenshot({ path: `${outputRoot}/workstation-v060-dark-canvas.png`, fullPage: true });

  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({
    screenshots: [
      "workstation-v060-today.png",
      "workstation-v060-goals.png",
      "workstation-v060-studio.png",
      "workstation-v060-review.png",
      "workstation-v060-knowledge.png",
      "workstation-v060-ai.png",
      "workstation-v060-canvas.png",
      "workstation-v060-dark-today.png",
      "workstation-v060-dark-ai.png",
      "workstation-v060-dark-canvas.png",
    ],
    canvasResize: { layoutWidth: Math.round(selectedLayoutWidth), screenWidth: Math.round(selectedBox.width), handles: resizeHandles },
    canvasPanelDocked: true,
    runtimeErrors,
  }, null, 2));
} finally {
  await browser.close();
}
