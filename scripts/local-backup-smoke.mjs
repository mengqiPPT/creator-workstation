import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2];
if (!modulePath) throw new Error("Pass the compiled localBackup.js path");
const {
  createLocalBackup,
  parseLocalBackup,
  restoreLocalBackup,
  workstationLocalKeys,
} = await import(pathToFileURL(modulePath).href);

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  removeItem(key) { this.values.delete(key); }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const source = new MemoryStorage({
  "workstation.tasks.v2": JSON.stringify([{ id: "real-task", title: "真实任务" }]),
  "workstation.canvas.v1": JSON.stringify({ nodes: [], edges: [] }),
  "workstation.fake-api-key": JSON.stringify("sk-must-not-export"),
  "unrelated.browser.setting": JSON.stringify({ keep: true }),
});

const created = createLocalBackup(source);
const serialized = JSON.stringify(created);
assert.equal(created.format, "workstation-local-backup");
assert.equal(created.version, 1);
assert.deepEqual(Object.keys(created.items).sort(), [
  "workstation.canvas.v1",
  "workstation.tasks.v2",
]);
assert.doesNotMatch(serialized, /sk-must-not-export|fake-api-key|unrelated\.browser/);

const parsed = parseLocalBackup(serialized);
const destination = new MemoryStorage({
  "workstation.creator-links": JSON.stringify([{ name: "旧数据" }]),
  "unrelated.browser.setting": JSON.stringify({ keep: true }),
});
restoreLocalBackup(destination, parsed);
assert.equal(destination.getItem("workstation.tasks.v2"), created.items["workstation.tasks.v2"]);
assert.equal(destination.getItem("workstation.creator-links"), null);
assert.equal(destination.getItem("unrelated.browser.setting"), JSON.stringify({ keep: true }));

const tampered = JSON.parse(serialized);
tampered.items["workstation.fake-api-key"] = JSON.stringify("sk-injected");
assert.throws(() => parseLocalBackup(JSON.stringify(tampered)), /不允许恢复/);
assert.equal(workstationLocalKeys.length, 6);

console.log(JSON.stringify({
  allowlistedKeys: workstationLocalKeys.length,
  exportedItems: Object.keys(created.items).length,
  secretLikeFieldExcluded: true,
  unrelatedStoragePreserved: true,
  tamperedBackupRejected: true,
}, null, 2));
