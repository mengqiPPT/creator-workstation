import {
  Button,
  Checkbox,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  ProgressBar,
} from "@fluentui/react-components";
import { Document24Regular, Lightbulb24Regular, Link24Regular, Open24Regular } from "@fluentui/react-icons";
import { formatCaptureTime } from "../lib/format";
import { SetupGuide } from "../SetupGuide";

import type { WorkstationStore } from "../useWorkstationStore";
import { CaptureComposer } from "./CaptureComposer";

const ACTIVITY_LABELS: Record<string, string> = {
  task_created: "新建任务",
  task_completed: "完成",
  task_reopened: "重新打开",
  task_deleted: "删除",
  task_restored: "已恢复",
  capture_added: "捕获灵感",
  capture_to_task: "从收件箱转任务",
  capture_archived: "已归档",
  review_saved: "保存了复盘",
};

export function TodayView({ store }: { store: WorkstationStore }) {
  const { todayLabel, greeting, pendingCount, captureTotal, vaultError, hasDemoTasks, vaultStatus, trackedTasks, aiStatus, setSettingsOpen, changeView, openAiConfigDialog, completion, todayTasks, toggleTask, creatorLinks, completedCount, activityEvents } = store;
  const recentActivity = activityEvents.slice(-8).reverse();
    return (
      <>
        <header className="today-intro creator-intro">
          <div>
            <p className="date-label">{todayLabel}</p>
            <h1>{greeting}。先把今天真正重要的事做完。</h1>
            <p className="intro-copy">
              任务、快速捕获和发布入口都在这一屏；配置和实验内容已经收起。
            </p>
          </div>
          <div className="briefing-panel" aria-label="今日简报">
            <div className="briefing-icon" aria-hidden="true">
              <Lightbulb24Regular />
            </div>
            <div>
              <strong>{pendingCount ? `还有 ${pendingCount} 项待完成` : "今天没有遗留任务"}</strong>
              <p>{captureTotal ? `收件箱里还有 ${captureTotal} 条内容待整理。` : "有新想法时，直接记录到下方收件箱。"}</p>
            </div>
          </div>
        </header>

        {vaultError ? (
          <MessageBar intent="warning">
            <MessageBarBody>
              <MessageBarTitle>Vault 接口未连接</MessageBarTitle>
              {vaultError}。请重新启动桌面应用；如果仍失败，可在设置中重新连接知识库。
            </MessageBarBody>
          </MessageBar>
        ) : null}

        {hasDemoTasks ? (
          <MessageBar intent="info">
            <MessageBarBody>
              <MessageBarTitle>当前任务是示例</MessageBarTitle>
              新建第一项真实任务时会自动移除示例；仪表盘不会把示例计入进度。
            </MessageBarBody>
          </MessageBar>
        ) : null}

        {!vaultStatus || vaultStatus.mode !== "configured" || !trackedTasks.length || !aiStatus?.lastTestedAt ? (
          <details className="onboarding-disclosure">
            <summary>
              <span>首次设置</span>
              <strong>连接你的数据与模型</strong>
              <small>按需展开，不妨碍日常工作</small>
            </summary>
            <SetupGuide
              vaultConfigured={vaultStatus?.mode === "configured"}
              hasRealTask={trackedTasks.length > 0}
              aiConfigured={Boolean(aiStatus?.configured)}
              aiTested={Boolean(aiStatus?.lastTestedAt)}
              onConnectVault={() => setSettingsOpen(true)}
              onOpenKnowledge={() => changeView("knowledge")}
              onOpenTasks={() => changeView("goals")}
              onConfigureModel={openAiConfigDialog}
              onOpenAi={() => changeView("ai")}
            />
          </details>
        ) : null}

        <div className="today-grid creator-home-grid">
          <div className="primary-column">
            <section className="work-section focus-section">
              <div className="section-heading">
                <div>
                  <h2>今天的目标任务</h2>
                  <p>这里优先显示每日任务，最近目标在任务页继续查看。</p>
                </div>
                <Button appearance="subtle" onClick={() => changeView("goals")}>
                  管理任务
                </Button>
              </div>
              <ProgressBar value={completion} thickness="large" />
              <div className="task-list">
                {todayTasks.length ? (
                  todayTasks.slice(0, 4).map((task) => (
                    <label className="task-row" key={task.id}>
                      <Checkbox
                        checked={task.done}
                        onChange={(_, data) =>
                          toggleTask(task.id, Boolean(data.checked))
                        }
                        aria-label={`标记任务：${task.title}`}
                      />
                      <span className={task.done ? "task-copy done" : "task-copy"}>
                        <strong>{task.title}</strong>
                        <small>
                          {task.project}
                          {task.demo ? " · 示例" : ""}
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <div className="empty-state compact-empty">
                    <strong>今天还没有任务</strong>
                    <p>在目标任务页添加第一项。</p>
                  </div>
                )}
              </div>
            </section>

            {<CaptureComposer store={store} />}
          </div>

          <aside className="secondary-column">
            <section className="work-section creator-shortcuts">
              <div className="section-heading">
                <div>
                  <h2>发布直达</h2>
                  <p>打开常用创作者后台。</p>
                </div>
                <Button appearance="subtle" onClick={() => changeView("studio")}>
                  全部入口
                </Button>
              </div>
              <div className="shortcut-list">
                {creatorLinks.slice(0, 3).map((link) => (
                  <a
                    className="shortcut-row"
                    href={link.url}
                    key={link.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Link24Regular aria-hidden="true" />
                    <span>
                      <strong>{link.name}</strong>
                      <small>{new URL(link.url).hostname}</small>
                    </span>
                    <Open24Regular aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>

            <section className="work-section dashboard-snapshot">
              <div className="section-heading">
                <div>
                  <h2>当前完成情况</h2>
                  <p>只统计工作台内的真实任务。</p>
                </div>
                <Button appearance="subtle" onClick={() => changeView("analytics")}>
                  开始复盘
                </Button>
              </div>
              <div className="snapshot-numbers">
                <div>
                  <strong>{completedCount}</strong>
                  <span>已完成</span>
                </div>
                <div>
                  <strong>{pendingCount}</strong>
                  <span>未完成</span>
                </div>
                <div>
                  <strong>{captureTotal}</strong>
                  <span>待整理</span>
                </div>
              </div>
            </section>

            <section className="work-section knowledge-section">
              <div className="knowledge-icon" aria-hidden="true">
                <Document24Regular />
              </div>
              <div>
                <h2>{vaultStatus?.vaultName ?? "Obsidian Vault"}</h2>
                <p>
                  {vaultStatus?.mode === "configured"
                    ? "已连接真实 Vault，可读取 Markdown。"
                    : "当前是演示知识库，不会当作你的私人资料。"}
                </p>
              </div>
            </section>

            <section className="work-section today-activity-card">
              <div className="section-heading">
                <div>
                  <h2>今日动态</h2>
                  <p>最近 8 条操作，按时间倒序。</p>
                </div>
                <Button appearance="subtle" onClick={() => changeView("analytics")}>
                  查看复盘
                </Button>
              </div>
              {recentActivity.length ? (
                <div className="activity-feed">
                  {recentActivity.map((event) => (
                    <div className="activity-row" key={event.id}>
                      <span
                        className="activity-marker"
                        aria-hidden="true"
                        data-kind={event.type}
                      />
                      <div className="activity-copy">
                        <strong>{event.title}</strong>
                        <small>
                          {ACTIVITY_LABELS[event.type] ?? event.type}
                          {" · "}
                          {formatCaptureTime(event.at)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty">
                  <strong>还没有操作记录</strong>
                  <p>开始勾选任务或捕获内容，就会出现在这里。</p>
                </div>
              )}
            </section>
          </aside>
        </div>

      </>
    );}
