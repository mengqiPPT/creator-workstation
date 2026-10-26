import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(workspace, ".tmp-setup-test-"));
const compiler = path.join(workspace, "node_modules", "typescript", "bin", "tsc");
const source = path.join(workspace, "src", "setupGuideModel.ts");

let buildSetupState;
try {
  execFileSync(process.execPath, [
    compiler,
    "--ignoreConfig",
    source,
    "--target", "ES2022",
    "--module", "ES2022",
    "--moduleResolution", "Bundler",
    "--skipLibCheck",
    "--outDir", tempRoot,
  ], { stdio: "pipe" });
  const compiled = await import(pathToFileURL(path.join(tempRoot, "setupGuideModel.js")).href);
  buildSetupState = compiled.buildSetupState;


const emptyState = buildSetupState({
  vaultConfigured: false,
  hasRealTask: false,
  aiConfigured: false,
  aiTested: false,
});
assert.equal(emptyState.completedCount, 0);
assert.equal(emptyState.nextStepId, "vault");
assert.equal(emptyState.steps[0].action, "连接 Vault");

const modelNeedsTest = buildSetupState({
  vaultConfigured: true,
  hasRealTask: true,
  aiConfigured: true,
  aiTested: false,
});
assert.equal(modelNeedsTest.completedCount, 2);
assert.equal(modelNeedsTest.nextStepId, "model");
assert.equal(modelNeedsTest.steps.at(-1).action, "测试连接");

const completeState = buildSetupState({
  vaultConfigured: true,
  hasRealTask: true,
  aiConfigured: true,
  aiTested: true,
});
assert.equal(completeState.completedCount, 3);
assert.equal(completeState.nextStepId, undefined);
assert.ok(completeState.steps.every((step) => step.complete));

console.log(JSON.stringify({
  emptyStateStartsWithVault: true,
  configuredModelStillRequiresTest: true,
  completeStateDetected: true,
}, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
