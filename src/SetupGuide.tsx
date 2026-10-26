import { Badge, Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import {
  ArrowRight24Regular,
  CheckmarkCircle24Regular,
  Circle24Regular,
  Settings24Regular,
} from "@fluentui/react-icons";
import {
  buildSetupState,
  type SetupStepId,
} from "./setupGuideModel";

type SetupGuideProps = {
  vaultConfigured: boolean;
  hasRealTask: boolean;
  aiConfigured: boolean;
  aiTested: boolean;
  onConnectVault: () => void;
  onOpenKnowledge: () => void;
  onOpenTasks: () => void;
  onConfigureModel: () => void;
  onOpenAi: () => void;
};

export function SetupGuide({
  vaultConfigured,
  hasRealTask,
  aiConfigured,
  aiTested,
  onConnectVault,
  onOpenKnowledge,
  onOpenTasks,
  onConfigureModel,
  onOpenAi,
}: SetupGuideProps) {
  const setupState = buildSetupState({
    vaultConfigured,
    hasRealTask,
    aiConfigured,
    aiTested,
  });
  const stepActions: Record<SetupStepId, () => void> = {
    vault: vaultConfigured ? onOpenKnowledge : onConnectVault,
    task: onOpenTasks,
    model: aiConfigured ? onOpenAi : onConfigureModel,
  };
  const nextStep = setupState.steps.find((step) => step.id === setupState.nextStepId);

  return (
    <section className="work-section setup-guide" aria-labelledby="setup-guide-title">
      <header className="setup-guide-heading">
        <div>
          <span className="setup-guide-icon" aria-hidden="true">
            <Settings24Regular />
          </span>
          <div>
            <h2 id="setup-guide-title">先把工作站变成你的</h2>
            <p>只完成三件事：连接数据、加入第一项任务、验证自己的模型。</p>
          </div>
        </div>
        <Badge appearance="outline">{setupState.completedCount} / {setupState.steps.length} 已完成</Badge>
      </header>

      {setupState.completedCount === setupState.steps.length ? (
        <MessageBar intent="success">
          <MessageBarBody>基础设置已经完成。接下来用一个真实工作日决定哪些板块值得长期保留。</MessageBarBody>
        </MessageBar>
      ) : nextStep ? (
        <div className="setup-next-action">
          <span>当前下一步</span>
          <strong>{nextStep.title}</strong>
          <Button
            appearance="primary"
            icon={<ArrowRight24Regular />}
            iconPosition="after"
            onClick={stepActions[nextStep.id]}
          >
            {nextStep.action}
          </Button>
        </div>
      ) : null}

      <div className="setup-step-list">
        {setupState.steps.map((step) => (
          <article className={step.complete ? "setup-step complete" : "setup-step"} key={step.id}>
            <span className="setup-step-status" aria-hidden="true">
              {step.complete ? <CheckmarkCircle24Regular /> : <Circle24Regular />}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
            <Button appearance="subtle" onClick={stepActions[step.id]}>
              {step.action}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
