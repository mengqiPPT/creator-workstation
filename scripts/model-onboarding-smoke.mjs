import assert from "node:assert/strict";
import { createServer } from "node:http";

const workstationBaseUrl = process.env.WORKSTATION_URL ?? "http://127.0.0.1:5173";
const mockPort = Number(process.env.MOCK_MODEL_PORT ?? 18932);
let requestCount = 0;

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
  requestCount += 1;
  assert.equal(body.model, "mock-onboarding");
  assert.ok(Array.isArray(body.messages));
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({
    model: "mock-onboarding",
    choices: [{ message: { content: "连接正常" } }],
    usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
  }));
});

await new Promise((resolve, reject) => {
  mockModel.once("error", reject);
  mockModel.listen(mockPort, "127.0.0.1", resolve);
});

let configuredByTest = false;
try {
  const initial = await fetch(`${workstationBaseUrl}/api/ai/status`).then((response) => response.json());
  assert.equal(initial.configured, false, "Refusing to replace an existing model configuration");

  const saved = await fetch(`${workstationBaseUrl}/api/ai/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      provider: "mock-onboarding",
      providerName: "Mock onboarding",
      baseUrl: `http://127.0.0.1:${mockPort}/v1`,
      model: "mock-onboarding",
      apiKey: "test-only-key",
    }),
  }).then((response) => response.json());
  configuredByTest = true;
  assert.equal(saved.configured, true);
  assert.equal(requestCount, 0, "Saving configuration must not call the model");

  const tested = await fetch(`${workstationBaseUrl}/api/ai/test`, { method: "POST" })
    .then((response) => response.json());
  assert.equal(tested.ok, true);
  assert.equal(tested.preview, "连接正常");
  assert.ok(tested.lastTestedAt);
  assert.equal(requestCount, 1, "Connection test must issue exactly one minimal model call");

  console.log(JSON.stringify({
    saveWasLocalOnly: true,
    testRequestCount: requestCount,
    testPreview: tested.preview,
    recordedLastTestedAt: Boolean(tested.lastTestedAt),
  }, null, 2));
} finally {
  if (configuredByTest) {
    await fetch(`${workstationBaseUrl}/api/ai/config`, { method: "DELETE" }).catch(() => undefined);
  }
  await new Promise((resolve) => mockModel.close(resolve));
}
