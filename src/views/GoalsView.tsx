import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  Option,
  ProgressBar,
} from "@fluentui/react-components";
import { Add24Regular, Delete24Regular, TargetArrow24Regular } from "@fluentui/react-icons";
import { localDateKey } from "../lib/format";
import type { Task, TaskPeriod } from "../types";

import type { WorkstationStore } from "../useWorkstationStore";

const HEAT_LABELS = ["周一", "", "周三", "", "周五", "", "周日"];

export function GoalsView({ store }: { store: WorkstationStore }) {
  const {
    toggleTask,
    requestDeleteTask,
    taskError,
    newTask,
    setNewTask,
    setTaskError,
    addTask,
    newTaskPeriod,
    setNewTaskPeriod,
    todayTasks,
    recentTasks,
    tasks,
    activityEvents,
  } = store;

  const trackedTasks = tasks.filter((task) => !task.demo);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const projects = aggregateProjects(trackedTasks);
  const heatmap = buildHeatmap(activityEvents, sevenDaysAgo);
  const pulse = buildPulse(activityEvents);

  const taskGroup = (title: string, description: string, items: Task[]) => (
    <section className="work-section goal-group">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Badge appearance="outline">{items.length} 项</Badge>
      </div>
      {items.length ? (
        <div className="task-list">
          {items.map((task) => (
            <div className="task-row task-manage-row" key={task.id}>
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
              <Button
                appearance="subtle"
                icon={<Delete24Regular />}
                aria-label="删除任务"
                title="删除任务"
                onClick={() => requestDeleteTask(task.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <strong>这里还没有任务</strong>
          <p>从上方添加一项，之后再决定是否需要截止日期或重复规则。</p>
        </div>
      )}
    </section>
  );

  return (
    <section className="page-section goals-page">
      <div className="page-heading">
        <div>
          <p className="date-label">目标任务</p>
          <h1>每天要做什么，最近在推进什么。</h1>
          <p>第一版只区分每日任务和最近目标，先不引入复杂优先级体系。</p>
        </div>
        <ProgressBar
          value={trackedTasks.length ? trackedTasks.filter((task) => task.done).length / trackedTasks.length : 0}
          thickness="large"
          style={{ width: 180 }}
        />
      </div>

      <section className="work-section goal-composer">
        <Field
          label="新增目标或任务"
          validationMessage={taskError || undefined}
          validationState={taskError ? "error" : "none"}
        >
          <Input
            value={newTask}
            onChange={(_, data) => {
              setNewTask(data.value);
              if (taskError) setTaskError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) addTask();
            }}
            placeholder="例如：完成本周视频选题初稿"
          />
        </Field>
        <Field label="显示范围">
          <Dropdown
            value={newTaskPeriod === "today" ? "今天" : "最近目标"}
            selectedOptions={[newTaskPeriod]}
            onOptionSelect={(_, data) =>
              setNewTaskPeriod((data.optionValue as TaskPeriod) ?? "today")
            }
          >
            <Option value="today">今天</Option>
            <Option value="recent">最近目标</Option>
          </Dropdown>
        </Field>
        <Button appearance="primary" icon={<Add24Regular />} onClick={addTask}>
          添加
        </Button>
      </section>

      <div className="goals-layout">
        <div className="goals-main">
          <div className="goal-groups">
            {taskGroup("今天", "打开工作台后最先看到的行动。", todayTasks)}
            {taskGroup("最近目标", "还在推进，但不一定今天完成。", recentTasks)}
          </div>
        </div>
        <aside className="goals-side">
          <section className="work-section goal-progress-panel">
            <div className="section-heading">
              <div>
                <h2>项目进度</h2>
                <p>按项目分组，只统计真实任务。</p>
              </div>
              <Badge appearance="outline">{projects.length} 个</Badge>
            </div>
            {projects.length ? (
              <div className="project-progress-list">
                {projects.map((project) => (
                  <div className="project-progress-item" key={project.name}>
                    <div className="project-progress-head">
                      <strong>{project.name}</strong>
                      <small>{project.completed}/{project.total} · {Math.round(project.ratio * 100)}%</small>
                    </div>
                    <div className="project-progress-bar" aria-hidden="true">
                      <i style={{ transform: `scaleX(${Math.max(0.04, project.ratio)})` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <strong>还没有分组</strong>
                <p>添加任务后会自动按项目聚合。</p>
              </div>
            )}
          </section>

          <section className="work-section goal-pulse-panel">
            <div className="section-heading">
              <div>
                <h2>本周节奏</h2>
                <p>过去 7 天的操作热力，颜色越深越密集。</p>
              </div>
              <Badge appearance="outline">近 7 天</Badge>
            </div>
            <div className="heat-grid" role="list">
              {heatmap.map((cell) => (
                <span
                  className="heat-cell"
                  role="listitem"
                  data-level={cell.level}
                  title={`${cell.date} · ${cell.count} 次操作`}
                  key={cell.date}
                />
              ))}
            </div>
            <div className="heat-axis" aria-hidden="true">
              {HEAT_LABELS.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
            <div className="pulse-summary-grid">
              <div className="pulse-summary-cell">
                <strong>{pulse.completedLast7}</strong>
                <small>近 7 天完成</small>
              </div>
              <div className="pulse-summary-cell">
                <strong>{pulse.createdLast7}</strong>
                <small>近 7 天新增</small>
              </div>
              <div className="pulse-summary-cell">
                <strong>{pulse.capturedLast7}</strong>
                <small>近 7 天捕获</small>
              </div>
              <div className="pulse-summary-cell">
                <strong>{pulse.reviewsLast7}</strong>
                <small>近 7 天复盘</small>
              </div>
            </div>
          </section>

          <section className="work-section goal-focus-card">
            <div className="section-heading">
              <div>
                <h2>下一步建议</h2>
                <p>系统按当前任务状态挑出 1 项该先做的事。</p>
              </div>
              <Badge appearance="tint" color="informative">
                <TargetArrow24Regular aria-hidden="true" />
                自动
              </Badge>
            </div>
            <NextFocus tasks={trackedTasks} />
          </section>
        </aside>
      </div>
    </section>
  );
}

function aggregateProjects(tasks: Task[]) {
  const buckets = new Map<string, { total: number; completed: number }>();
  for (const task of tasks) {
    const name = task.project || "未分组";
    const current = buckets.get(name) ?? { total: 0, completed: 0 };
    current.total += 1;
    if (task.done) current.completed += 1;
    buckets.set(name, current);
  }
  return Array.from(buckets.entries())
    .map(([name, value]) => ({
      name,
      total: value.total,
      completed: value.completed,
      ratio: value.total ? value.completed / value.total : 0,
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 6);
}

function buildHeatmap(events: { at: string }[], sinceMs: number) {
  const days: Array<{ date: string; count: number; level: number; ts: number }> = [];
  const now = new Date();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    days.push({ date: localDateKey(day), count: 0, level: 0, ts: day.getTime() });
  }
  for (const event of events) {
    const time = Date.parse(event.at);
    if (!Number.isFinite(time) || time < sinceMs) continue;
    const key = localDateKey(new Date(time));
    const day = days.find((entry) => entry.date === key);
    if (day) day.count += 1;
  }
  const max = days.reduce((acc, day) => Math.max(acc, day.count), 0);
  for (const day of days) {
    if (max === 0) day.level = 0;
    else if (day.count === 0) day.level = 0;
    else if (day.count >= max * 0.75) day.level = 4;
    else if (day.count >= max * 0.5) day.level = 3;
    else if (day.count >= max * 0.25) day.level = 2;
    else day.level = 1;
  }
  return days;
}

function buildPulse(events: { at: string; type: string }[]) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const inWindow = events.filter((event) => {
    const time = Date.parse(event.at);
    return Number.isFinite(time) && time >= since;
  });
  return {
    completedLast7: inWindow.filter((event) => event.type === "task_completed").length,
    createdLast7: inWindow.filter((event) => event.type === "task_created" || event.type === "capture_to_task").length,
    capturedLast7: inWindow.filter((event) => event.type === "capture_added" || event.type === "capture_archived").length,
    reviewsLast7: inWindow.filter((event) => event.type === "review_saved").length,
  };
}

function NextFocus({ tasks }: { tasks: Task[] }) {
  const open = tasks
    .filter((task) => !task.done)
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
  if (!open.length) {
    return (
      <div className="empty-state compact-empty">
        <strong>没有遗留任务</strong>
        <p>全部清空后，从这里挑下一个想做的事。</p>
      </div>
    );
  }
  const target = open[0];
  return (
    <div className="task-row task-manage-row" key={target.id}>
      <span className="task-copy">
        <strong>{target.title}</strong>
        <small>
          {target.project}
          {" · "}
          {target.period === "today" ? "今天" : "最近目标"}
        </small>
      </span>
      <Badge appearance="tint" color="brand">优先</Badge>
    </div>
  );
}
