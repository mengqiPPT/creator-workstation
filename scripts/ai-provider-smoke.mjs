import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/22073/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const outputRoot =
  "C:/Users/22073/.codex/visualizations/2026/08/01/019fbe12-ab5c-7c90-8e5e-795651684cc6";
const secretsFile = "D:/桌面/小黄的工作站/.workstation.secrets.json";
const fakeKey = "workstation-test-key-not-real";
const requests = [];

const mockServer = http.createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  requests.push({
    url: request.url,
    authorization: request.headers.authorization,
    body: JSON.parse(raw || "{}"),
  });
  response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({
    id: "mock-response",
    model: "workstation-mock-model",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: requests.length === 1
          ? "连接成功"
          : "# 模拟模型结果\n\n已根据本次明确授权的上下文完成生成。",
      },
    }],
    usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
  }));
});

await new Promise((resolve) => mockServer.listen(8787, "127.0.0.1", resolve));

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

try {
  await fs.unlink(secretsFile).catch(() => {});
  const context = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto("http://127.0.0.1:5173/#ai", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "用你自己的模型，带走更少的上下文。" }).waitFor();
  await page.getByRole("button", { name: "配置模型" }).click();
  const providerPicker = page.getByRole("combobox", { name: "模型服务" });
  await providerPicker.focus();
  await providerPicker.press("Alt+ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByLabel("显示名称").fill("本机兼容测试");
  await page.getByLabel("API 基础地址").fill("http://127.0.0.1:8787/v1");
  await page.getByLabel("模型 ID").fill("workstation-mock-model");
  await page.getByLabel("API Key").fill(fakeKey);
  await page.getByRole("button", { name: "保存模型配置" }).click();
  await page.getByText("本机兼容测试 待测试", { exact: true }).waitFor();

  const status = await page.evaluate(async () => (await fetch("/api/ai/status")).json());
  assert.equal(status.configured, true);
  assert.equal(status.providerName, "本机兼容测试");
  assert.equal("apiKey" in status, false);
  assert.equal(status.keyHint.endsWith("real"), true);
  assert.equal((await page.locator("body").innerText()).includes(fakeKey), false);
  assert((await fs.readFile(secretsFile, "utf8")).includes(fakeKey));

  await page.getByRole("button", { name: "测试连接" }).click();
  await page.getByText(/连接成功，模型返回/).waitFor();
  assert.equal(requests[0].url, "/v1/chat/completions");
  assert.equal(requests[0].authorization, `Bearer ${fakeKey}`);

  await page.getByRole("button", { name: /内容提纲/ }).click();
  await page.getByRole("button", { name: "调用 本机兼容测试" }).click();
  await page.getByText("# 模拟模型结果", { exact: false }).waitFor();
  assert.equal(requests.length, 2);
  const generatedPrompt = requests[1].body.messages[1].content;
  assert(generatedPrompt.includes("本次用户明确授权的上下文"));
  assert(generatedPrompt.includes('"tasks"'));
  assert(generatedPrompt.includes('"notes"'));
  assert.equal(requests[1].authorization, `Bearer ${fakeKey}`);

  await page.screenshot({
    path: `${outputRoot}/workstation-ai-domestic-config-light.png`,
    fullPage: true,
  });
  await page.locator(".topbar-actions button").last().click();
  await page.screenshot({
    path: `${outputRoot}/workstation-ai-domestic-config-dark.png`,
    fullPage: true,
  });

  const mobileContext = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://127.0.0.1:5173/#ai", { waitUntil: "networkidle" });
  await mobilePage.getByRole("heading", { name: "用你自己的模型，带走更少的上下文。" }).waitFor();
  await mobilePage.screenshot({
    path: `${outputRoot}/workstation-ai-domestic-config-mobile.png`,
    fullPage: true,
  });
  await mobileContext.close();

  await page.getByRole("button", { name: "配置模型" }).click();
  await page.getByRole("button", { name: "清除配置" }).evaluate((element) => element.click());
  await page.getByRole("heading", { name: "清除模型配置？" }).waitFor();
  await page.getByRole("button", { name: "确认清除" }).evaluate((element) => element.click());
  await page.getByText("尚未配置模型", { exact: true }).waitFor();
  await assert.rejects(fs.access(secretsFile));
  assert.deepEqual(runtimeErrors, []);

  console.log(JSON.stringify({
    configSavedLocally: true,
    secretNotExposedByStatus: true,
    testConnectionPassed: true,
    generationPassed: true,
    authorizedContextObserved: true,
    configCleared: true,
    runtimeErrors,
    screenshots: [
      "workstation-ai-domestic-config-light.png",
      "workstation-ai-domestic-config-dark.png",
      "workstation-ai-domestic-config-mobile.png",
    ],
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => mockServer.close((error) => error ? reject(error) : resolve()));
  await fs.unlink(secretsFile).catch(() => {});
}
