import { 
  Badge,
  Button,
  Field,
  MessageBar,
  MessageBarBody,
  Textarea,
 } from "@fluentui/react-components";
import { Copy24Regular, Open24Regular, TargetArrow24Regular } from "@fluentui/react-icons";
import { formatCaptureTime, localDateKey } from "../lib/format";

import type { WorkstationStore } from "../useWorkstationStore";

export function AnalyticsView({ store }: { store: WorkstationStore }) {
  const { trackedTasks, activityEvents, reviewDate, captures, completedCount, pendingCount, completion, reviewRevision, reviewWins, updateReviewInput, reviewFriction, reviewTomorrow, captureTotal, generateReview, reviewDraft, updateReviewDraft, reviewSaving, vaultStatus, reviewTarget, obsidianUri, reviewMessage, reviewError, reviewHistory, saveDailyReview, copyText } = store;
    const completedTasks = trackedTasks
      .filter((task) => task.done)
      .sort((left, right) =>
        (right.completedAt ?? "").localeCompare(left.completedAt ?? ""),
      );
    const pendingTasks = trackedTasks
      .filter((task) => !task.done)
      .sort((left, right) =>
        (right.createdAt ?? "").localeCompare(left.createdAt ?? ""),
      );
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completedLast7Days = completedTasks.filter((task) => {
      const time = task.completedAt ? Date.parse(task.completedAt) : Number.NaN;
      return Number.isFinite(time) && time >= sevenDaysAgo;
    }).length;
    const createdLast7Days = trackedTasks.filter((task) => {
      const time = task.createdAt ? Date.parse(task.createdAt) : Number.NaN;
      return Number.isFinite(time) && time >= sevenDaysAgo;
    }).length;
    const todayActivities = activityEvents.filter((event) => localDateKey(new Date(event.at)) === reviewDate);
    const completedToday = todayActivities.filter((event) => event.type === "task_completed").length;
    const capturedToday = captures.filter((entry) => localDateKey(new Date(entry.createdAt)) === reviewDate).length;

    return (
      <section className="page-section analytics-page">
        <div className="page-heading">
          <div>
            <p className="date-label">每日复盘 · {reviewDate}</p>
            <h1>结束一天之前，把事实、判断和明天第一步收好。</h1>
            <p>系统整理真实操作，你补上判断；保存后会进入自己的 Obsidian，而不是留在一次性页面里。</p>
          </div>
        </div>

        <section className="metric-grid" aria-label="当前统计">
          <article>
            <span>总任务</span>
            <strong>{trackedTasks.length}</strong>
            <small>不含示例任务</small>
          </article>
          <article>
            <span>已完成</span>
            <strong>{completedCount}</strong>
            <small>已勾选完成</small>
          </article>
          <article>
            <span>未完成</span>
            <strong>{pendingCount}</strong>
            <small>仍需处理</small>
          </article>
          <article>
            <span>近 7 天完成</span>
            <strong>{completedLast7Days}</strong>
            <small>按完成时间统计</small>
          </article>
          <article>
            <span>近 7 天新增</span>
            <strong>{createdLast7Days}</strong>
            <small>按创建时间统计</small>
          </article>
        </section>

        <div className="analytics-layout">
          <section className="work-section completion-panel">
            <div className="analytics-overview">
              {trackedTasks.length ? <div
                className="completion-ring"
                aria-label={`任务完成率 ${Math.round(completion * 100)}%`}
              >
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <defs>
                    <linearGradient id="completionGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop className="ring-stop-start" offset="0%" />
                      <stop className="ring-stop-end" offset="100%" />
                    </linearGradient>
                  </defs>
                  <circle className="completion-ring-track" cx="60" cy="60" r="50" pathLength="100" />
                  <circle
                    className="completion-ring-value"
                    cx="60"
                    cy="60"
                    r="50"
                    pathLength="100"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.round(completion * 100)} 100`}
                  />
                </svg>
                <span>
                  <strong>{Math.round(completion * 100)}%</strong>
                  <small>完成率</small>
                </span>
              </div> : <div className="analytics-empty-ring" aria-hidden="true"><TargetArrow24Regular /></div>}
              <div className="analytics-progress-copy">
                <span className="analytics-kicker">任务完成情况</span>
                <h2>{trackedTasks.length === 0
                  ? "还没有可以统计的真实任务"
                  : pendingCount
                    ? `还有 ${pendingCount} 项没有收尾`
                    : "当前任务已经全部完成"}</h2>
                <p>{trackedTasks.length ? "只统计真实任务。这里反映当前任务状态，不把它伪装成长期历史报表。" : "先建立一项真实任务，仪表盘才会开始形成可靠记录。"}</p>
                <div className="analytics-breakdown" aria-label="任务状态明细">
                  <span><i className="complete" />已完成 <strong>{completedCount}</strong></span>
                  <span><i className="pending" />未完成 <strong>{pendingCount}</strong></span>
                </div>
              </div>
            </div>
            <div className="status-columns">
              <div>
                <h3>最近完成</h3>
                {completedTasks.length ? (
                  completedTasks.map((task) => (
                    <p className="status-item" key={task.id}>
                      <span>{task.title}</span>
                      <small>
                        {task.completedAt
                          ? formatCaptureTime(task.completedAt)
                          : "完成时间未记录"}
                      </small>
                    </p>
                  ))
                ) : (
                  <p>暂时没有完成记录。</p>
                )}
              </div>
              <div>
                <h3>仍未完成</h3>
                {pendingTasks.length ? (
                  pendingTasks.map((task) => (
                    <p className="status-item" key={task.id}>
                      <span>{task.title}</span>
                      <small>
                        {task.createdAt ? formatCaptureTime(task.createdAt) : "创建时间未记录"}
                      </small>
                    </p>
                  ))
                ) : (
                  <p>当前没有遗留任务。</p>
                )}
              </div>
            </div>
          </section>

          <section className="work-section review-editor analytics-review">
            <div className="section-heading">
              <div>
                <h2>今日复盘</h2>
                <p>今天完成 {completedToday} 项，捕获 {capturedToday} 条，仍有 {pendingCount} 项待处理。</p>
              </div>
              <Badge appearance="tint" color={reviewRevision ? "success" : "informative"}>
                {reviewRevision ? "已保存" : "未保存"}
              </Badge>
            </div>

            <div className="review-guidance" aria-label="复盘引导问题">
              <Field label="今天最值得保留的成果">
                <Textarea
                  value={reviewWins}
                  onChange={(_, data) => updateReviewInput("wins", data.value)}
                  placeholder="不是完成了多少，而是哪件事真正有价值？"
                  resize="vertical"
                  rows={2}
                />
              </Field>
              <Field label="卡点与原因">
                <Textarea
                  value={reviewFriction}
                  onChange={(_, data) => updateReviewInput("friction", data.value)}
                  placeholder="哪里不顺，问题来自信息、时间、工具还是决定？"
                  resize="vertical"
                  rows={2}
                />
              </Field>
              <Field label="明天的第一步">
                <Textarea
                  value={reviewTomorrow}
                  onChange={(_, data) => updateReviewInput("tomorrow", data.value)}
                  placeholder="写一个明天打开工作站后可以立刻开始的动作。"
                  resize="vertical"
                  rows={2}
                />
              </Field>
            </div>

            <Button
              appearance="primary"
              disabled={!trackedTasks.length && !captureTotal && !reviewWins && !reviewFriction && !reviewTomorrow}
              onClick={generateReview}
            >
              {reviewDraft ? "按最新记录重新生成（会替换下方）" : "生成今日复盘"}
            </Button>
            {reviewDraft ? (
              <>
                <Textarea
                  value={reviewDraft}
                  onChange={(_, data) => updateReviewDraft(data.value)}
                  resize="vertical"
                  rows={18}
                />
                <div className="review-actions">
                  <div className="review-action-buttons">
                    <Button
                      appearance="primary"
                      disabled={reviewSaving || vaultStatus?.mode !== "configured"}
                      onClick={() => void saveDailyReview()}
                    >
                      {reviewSaving ? "正在保存…" : reviewRevision ? "更新 Obsidian 复盘" : "保存到 Obsidian"}
                    </Button>
                    <Button
                      icon={<Copy24Regular />}
                      onClick={() => void copyText(reviewDraft, "复盘已复制。")}
                    >
                      复制
                    </Button>
                    {reviewTarget && vaultStatus?.mode === "configured" ? (
                      <Button as="a" href={obsidianUri(reviewTarget)} icon={<Open24Regular />}>在 Obsidian 打开</Button>
                    ) : null}
                  </div>
                  <span>{reviewTarget || `${vaultStatus?.reviewFolder ?? "Workstation/Reviews"}/${reviewDate}.md`}</span>
                </div>
              </>
            ) : (
              <div className="empty-state compact-empty">
                <strong>先回答三个问题</strong>
                <p>工作站会把回答和今天的完成、遗留、捕获一起整理成 Markdown。</p>
              </div>
            )}
            {reviewMessage ? <MessageBar intent="success"><MessageBarBody>{reviewMessage}</MessageBarBody></MessageBar> : null}
            {reviewError ? <MessageBar intent="error"><MessageBarBody>{reviewError}</MessageBarBody></MessageBar> : null}

            <div className="review-history">
              <div>
                <strong>最近复盘</strong>
                <span>{reviewHistory.length ? `已在 Vault 找到 ${reviewHistory.length} 天` : "保存第一篇后会从这里回看"}</span>
              </div>
              {reviewHistory.slice(0, 7).map((item) => (
                <a key={item.date} href={obsidianUri(item.target)}>
                  <span>{item.date}</span>
                  <Open24Regular />
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>
    );}
