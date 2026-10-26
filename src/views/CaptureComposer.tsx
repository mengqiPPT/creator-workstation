import { Badge, Button, Field, Textarea } from "@fluentui/react-components";
import { Add24Regular } from "@fluentui/react-icons";

import type { WorkstationStore } from "../useWorkstationStore";

export function CaptureComposer({ store, compact = false }: { store: WorkstationStore; compact?: boolean }) {
  const { captureError, capture, setCapture, setCaptureError, vaultStatus, openWritePreview } = store;
    return (
      <section className={compact ? "capture-panel compact" : "capture-panel"}>
        <div className="section-heading">
          <div>
            <h2>快速捕获</h2>
            <p>先接住内容，再决定它属于任务、项目还是知识。</p>
          </div>
          <Badge appearance="tint" color="informative">
            写入前确认
          </Badge>
        </div>
        <Field
          label="现在想到什么？"
          validationMessage={captureError || undefined}
          validationState={captureError ? "error" : "none"}
        >
          <Textarea
            value={capture}
            onChange={(_, data) => {
              setCapture(data.value);
              if (captureError) setCaptureError("");
            }}
            placeholder="例如：整理工作站首页需要回答的三个问题"
            resize="vertical"
            rows={compact ? 3 : 4}
          />
        </Field>
        <div className="capture-footer">
          <span>
            目标：<code>{vaultStatus?.target ?? "Inbox/Capture.md"}</code>
          </span>
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={openWritePreview}
          >
            预览写入
          </Button>
        </div>
      </section>
    );}
