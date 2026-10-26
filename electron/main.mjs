import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedExternalProtocols = new Set(["https:", "obsidian:"]);
const stablePort = Number.parseInt(process.env.WORKSTATION_PORT ?? "17431", 10);
let startupLogPath = path.join(desktopRoot, "desktop-startup.log");

let mainWindow = null;
let localServer = null;
let localOrigin = "";
let sessionToken = "";

function writeStartupLog(message, error) {
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : error ? String(error) : "";
  try {
    appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ""}\n`, "utf8");
  } catch (logError) {
    console.error("Unable to write desktop startup log", logError);
  }
}

function openExternal(urlValue) {
  try {
    const target = new URL(urlValue);
    if (!allowedExternalProtocols.has(target.protocol)) return;
    void shell.openExternal(target.toString());
  } catch {
    // Ignore malformed URLs originating from user-managed creator links.
  }
}

async function startLocalServer() {
  const appRoot = app.isPackaged ? app.getAppPath() : desktopRoot;
  const dataRoot = app.isPackaged ? app.getPath("userData") : desktopRoot;
  const port = stablePort;

  process.env.WORKSTATION_APP_ROOT = appRoot;
  process.env.WORKSTATION_DATA_DIR = dataRoot;
  process.env.WORKSTATION_DESKTOP = "1";
  sessionToken = crypto.randomBytes(32).toString("hex");
  process.env.WORKSTATION_SESSION_TOKEN = sessionToken;
  globalThis.__WORKSTATION_SAFE_STORAGE__ = safeStorage;
  writeStartupLog(`Starting local server from ${appRoot} on port ${port}`);
  const { preview } = await import("vite");

  localServer = await preview({
    root: appRoot,
    configFile: path.join(appRoot, "vite.config.ts"),
    configLoader: "runner",
    logLevel: "error",
    preview: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      open: false,
    },
  });

  localOrigin = `http://127.0.0.1:${port}`;
  writeStartupLog(`Local server ready at ${localOrigin}`);
  return localOrigin;
}

function createMainWindow(origin) {
  const statePath = path.join(app.getPath("userData"), "window-state.json");
  let savedState = {};
  try {
    savedState = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    savedState = {};
  }
  const window = new BrowserWindow({
    width: Number(savedState.width) || 1460,
    height: Number(savedState.height) || 920,
    x: Number.isFinite(savedState.x) ? savedState.x : undefined,
    y: Number.isFinite(savedState.y) ? savedState.y : undefined,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#111315",
    title: "小黄的工作站",
    icon: path.join(app.isPackaged ? app.getAppPath() : desktopRoot, "build", "icon.png"),
    webPreferences: {
      preload: path.join(app.isPackaged ? app.getAppPath() : desktopRoot, "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  const authorizedHeaders = { "X-Workstation-Token": sessionToken };
  window.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: [`${origin}/api/*`] },
    (details, callback) => callback({ requestHeaders: { ...details.requestHeaders, ...authorizedHeaders } }),
  );
  if (savedState.maximized) window.maximize();

  let stateTimer;
  const persistWindowState = () => {
    clearTimeout(stateTimer);
    stateTimer = setTimeout(() => {
      if (window.isDestroyed()) return;
      const bounds = window.getNormalBounds();
      try {
        writeFileSync(statePath, JSON.stringify({ ...bounds, maximized: window.isMaximized() }, null, 2), "utf8");
      } catch (error) {
        writeStartupLog("Unable to save window state", error);
      }
    }, 180);
  };
  window.on("resize", persistWindowState);
  window.on("move", persistWindowState);
  window.on("maximize", persistWindowState);
  window.on("unmaximize", persistWindowState);

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin === origin) return;
    } catch {
      // Invalid URLs are blocked below.
    }
    event.preventDefault();
    openExternal(url);
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

  window.once("ready-to-show", () => window.show());
  window.webContents.on("console-message", (_event, level, message) => writeStartupLog(`Renderer console ${level}: ${message}`));
  window.webContents.on("render-process-gone", (_event, details) => {
    writeStartupLog(`Renderer process exited: ${details.reason} (${details.exitCode})`);
    if (!window.isDestroyed()) {
      dialog.showErrorBox("页面进程意外退出", "工作站页面没有正常启动。请重新打开应用，详细信息已写入启动日志。");
    }
  });
  window.webContents.on("did-fail-load", (_, code, description, validatedURL) => {
    writeStartupLog(`Renderer failed to load ${validatedURL}: ${code} ${description}`);
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  void window.loadURL(`${origin}/`).then(() => {
    if (!window.isDestroyed()) {
      window.show();
      writeStartupLog("Main window loaded and shown");
    }
  }).catch((error) => writeStartupLog("Main window load failed", error));
  return window;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    startupLogPath = path.join(app.getPath("userData"), "desktop-startup.log");
    writeStartupLog("Electron app is ready");
    app.setAppUserModelId("cn.xiaohuang.workstation");
    ipcMain.handle("workstation:choose-vault", async () => {
      const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
        title: "选择 Obsidian Vault 文件夹",
        properties: ["openDirectory"],
      });
      return result.canceled ? null : result.filePaths[0] ?? null;
    });
    ipcMain.handle("workstation:save-media", async (_event, input) => {
      const name = typeof input?.name === "string" ? path.basename(input.name).slice(0, 180) : "附件";
      const mimeType = typeof input?.type === "string" ? input.type.slice(0, 120) : "application/octet-stream";
      const bytes = input?.bytes instanceof ArrayBuffer
        ? Buffer.from(input.bytes)
        : ArrayBuffer.isView(input?.bytes)
          ? Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength)
          : null;
      if (!bytes?.length) throw new Error("附件内容为空");
      if (bytes.length > 250 * 1024 * 1024) throw new Error("单个附件不能超过 250 MB");
      const extension = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 12);
      const id = `${crypto.randomUUID()}${extension}`;
      const mediaRoot = path.join(app.getPath("userData"), "media");
      await fs.mkdir(mediaRoot, { recursive: true });
      await fs.writeFile(path.join(mediaRoot, id), bytes);
      return { id, name, mimeType, size: bytes.length, url: `/api/media/${encodeURIComponent(id)}` };
    });
    ipcMain.handle("workstation:remove-media", async (_event, input) => {
      const id = typeof input === "string" ? input : "";
      if (!/^[0-9a-f-]{36}(?:\.[a-z0-9]{1,10})?$/i.test(id)) {
        throw new Error("附件标识不正确");
      }
      const mediaRoot = path.join(app.getPath("userData"), "media");
      const filePath = path.join(mediaRoot, id);
      if (path.dirname(filePath) !== mediaRoot) throw new Error("附件路径不正确");
      await fs.rm(filePath, { force: true });
      return { ok: true };
    });
    ipcMain.handle("workstation:create-shortcut", async () => {
      let shortcutPath = path.join(app.getPath("desktop"), "小黄的工作站.lnk");
      if (!existsSync(path.dirname(shortcutPath))) {
        const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
          title: "选择桌面快捷方式保存位置",
          defaultPath: "小黄的工作站.lnk",
          filters: [{ name: "Windows 快捷方式", extensions: ["lnk"] }],
        });
        if (result.canceled || !result.filePath) return { ok: false, canceled: true };
        shortcutPath = result.filePath;
      }
      mkdirSync(path.dirname(shortcutPath), { recursive: true });
      const ok = shell.writeShortcutLink(shortcutPath, {
        target: process.execPath,
        cwd: path.dirname(process.execPath),
        description: "小黄的工作站",
        icon: path.join(app.getAppPath(), "build", "icon.ico"),
        iconIndex: 0,
      });
      return { ok, path: shortcutPath };
    });
    const origin = await startLocalServer();
    mainWindow = createMainWindow(origin);

    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length) {
        mainWindow = createMainWindow(localOrigin);
      }
    });
  }).catch((error) => {
    writeStartupLog("Desktop startup failed", error);
    console.error("Desktop startup failed", error);
    dialog.showErrorBox(
      "小黄的工作站启动失败",
      `本地服务没有成功启动。\n\n${error instanceof Error ? error.message : String(error)}\n\n详细日志：${startupLogPath}`,
    );
    app.quit();
  });
}

process.on("uncaughtException", (error) => writeStartupLog("Uncaught exception", error));
process.on("unhandledRejection", (error) => writeStartupLog("Unhandled rejection", error));

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (localServer) void localServer.close();
});
