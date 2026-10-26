# 本地桌面应用方案

## 结论

这个工作站可以打包成 Windows 桌面软件，不必长期依赖浏览器标签页。

当前项目同时包含 React 页面和 Node 本机能力：读取 Obsidian Vault、保存 API Key、调用模型和写入 Markdown。因此它不是一个适合直接部署成纯静态网页的项目。

## 推荐路线：先 Electron，稳定后再评估 Tauri

### Electron

- 优点：现有 Node `fs`、`path` 和本机 API 逻辑可大量复用，最快得到可安装的 `.exe`。
- 可实现：独立窗口、开始菜单、桌面快捷方式、托盘、开机启动、本地文件选择器和自动更新。
- 代价：安装包和内存占用比 Tauri 大。

### Tauri 2

- 优点：安装包小、运行占用低、系统集成好。
- 代价：当前写在 Vite/Node 中的本机文件与 API 逻辑需要迁移到 Rust command，或维护 Node sidecar，第一阶段成本更高。

### PWA

- 优点：改动最少，可以像应用一样固定到桌面。
- 局限：任意 Vault 文件夹访问、密钥保存和后台本机服务能力受浏览器限制，不适合作为这个项目的最终形态。

## Electron 落地顺序

1. 将 `vite.config.ts` 中的 Vault 和 AI 逻辑抽到独立的 `server/` 模块。
2. 增加 Electron 主进程和安全的 preload bridge，禁止页面直接获得 Node 全权限。
3. 开发模式加载 Vite，生产模式加载打包后的 `dist`。
4. 使用系统文件夹选择器连接 Obsidian Vault。
5. 将 API Key 迁移到 Windows Credential Manager 或 Electron `safeStorage`。
6. 加入安装器、单实例锁、日志目录和数据迁移机制。
7. 完成签名、自动更新和卸载数据策略后再作为正式桌面软件分发。

## 数据边界

- Vault 保持原始 Markdown，可脱离工作站直接由 Obsidian 读取。
- API Key 不进入前端、浏览器存储、备份文件或 Git。
- 桌面壳只获得用户明确选择的 Vault 目录权限。
- 外部模型调用继续只发送本机检索命中的最少片段。
