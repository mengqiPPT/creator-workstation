import assert from "node:assert/strict";
import { createServer } from "node:http";

const workstationBaseUrl = process.env.WORKSTATION_URL ?? "http://127.0.0.1:5173";
const mockPort = Number(process.env.MOCK_MODEL_PORT ?? 18931);
const upstreamRequests = [];

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return JSON.parse(raw || "{}");
}

const mockModel = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.statusCode = 404;
    response.end();
    return;
  }
  const body = await readBody(request);
  upstreamRequests.push(body);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({
    model: "mock-private-butler",
    choices: [{
      message: {
        content: "你总结过：工作站首页应先回答今天要做什么，并避免堆放不会改变行动的数据。[1]",
      },
    }],
    usage: { prompt_tokens: 120, completion_tokens: 28, total_tokens: 148 },
  }));
});

await new Promise((resolve, reject) => {
  mockModel.once("error", reject);
  mockModel.listen(mockPort, "127.0.0.1", resolve);
});

let configuredByTest = false;
try {
  const initialStatus = await fetch(`${workstationBaseUrl}/api/ai/status`).then((response) => response.json());
  assert.equal(initialStatus.configured, false, "Refusing to replace an existing model configuration");

  const vaultStatus = await fetch(`${workstationBaseUrl}/api/vault/status`).then((response) => response.json());
  const noteIndex = await fetch(`${workstationBaseUrl}/api/vault/notes`).then((response) => response.json());
  const safeAnchor = noteIndex.notes
    .filter((note) => !/(^|\/)99_|个人档案|关于我/.test(note.path))
    .sort((left, right) => right.title.length - left.title.length)[0];
  assert.ok(safeAnchor, "The connected Vault needs at least one non-profile Markdown note");
  const retrievalQuery = vaultStatus.mode === "demo"
    ? "我以前总结过哪些工作站设计原则？"
    : safeAnchor.title;
  const expectedPath = vaultStatus.mode === "demo"
    ? "Knowledge/Workstation Principles.md"
    : safeAnchor.path;

  const configured = await fetch(`${workstationBaseUrl}/api/ai/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      provider: "mock",
      providerName: "Mock model",
      baseUrl: `http://127.0.0.1:${mockPort}/v1`,
      model: "mock-private-butler",
      apiKey: "test-only-key",
    }),
  }).then((response) => response.json());
  assert.equal(configured.configured, true);
  configuredByTest = true;

  const preview = await fetch(`${workstationBaseUrl}/api/vault/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ query: retrievalQuery, limit: 6 }),
  }).then((response) => response.json());
  assert.equal(preview.ok, true);
  assert.ok(preview.sources.length > 0);
  assert.equal(preview.sources[0].path, expectedPath);
  assert.ok(preview.sources.every((source) => source.excerpt.length <= 900));

  const answer = await fetch(`${workstationBaseUrl}/api/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mode: "knowledge",
      request: retrievalQuery,
      useKnowledgeBase: true,
      context: {
        tasks: [],
        captures: [],
        notes: [{ title: "SHOULD_NOT_USE", path: "private.md", excerpt: "FULL_FRONTEND_NOTE" }],
      },
    }),
  }).then((response) => response.json());
  assert.equal(answer.ok, true);
  assert.equal(answer.grounded, true);
  assert.equal(answer.sources[0].path, expectedPath);
  assert.match(answer.text, /\[1\]/);
  assert.equal(upstreamRequests.length, 1);
  const upstreamPrompt = upstreamRequests[0].messages.map((message) => message.content).join("\n");
  assert.ok(upstreamPrompt.includes(expectedPath));
  assert.match(upstreamPrompt, /仅发送以下命中内容/);
  assert.doesNotMatch(upstreamPrompt, /SHOULD_NOT_USE|FULL_FRONTEND_NOTE/);

  const missing = await fetch(`${workstationBaseUrl}/api/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mode: "knowledge",
      request: "量子香蕉星际航海完全无关词条",
      useKnowledgeBase: true,
      context: {},
    }),
  }).then((response) => response.json());
  assert.equal(missing.ok, true);
  assert.equal(missing.grounded, false);
  assert.deepEqual(missing.sources, []);
  assert.equal(upstreamRequests.length, 1, "No-match knowledge questions must not call the model");

  console.log(JSON.stringify({
    retrievalTop: preview.sources[0].path,
    retrievalCount: preview.sources.length,
    longestExcerpt: Math.max(...preview.sources.map((source) => source.excerpt.length)),
    groundedAnswer: answer.grounded,
    noMatchSkippedModel: upstreamRequests.length === 1,
    frontendNoteIgnored: !upstreamPrompt.includes("FULL_FRONTEND_NOTE"),
  }, null, 2));
} finally {
  if (configuredByTest) {
    await fetch(`${workstationBaseUrl}/api/ai/config`, { method: "DELETE" }).catch(() => undefined);
  }
  await new Promise((resolve) => mockModel.close(resolve));
}
