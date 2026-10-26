import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  scope?: "app" | "view";
};

type ErrorBoundaryState = {
  failed: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workstation render error", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const isAppError = this.props.scope === "app";
    return (
      <section className={isAppError ? "fatal-error-state" : "view-error-state"} role="alert">
        <span className="error-kicker">页面没有正常加载</span>
        <h1>{isAppError ? "工作站遇到了启动问题" : "这个模块暂时无法显示"}</h1>
        <p>
          你的本地任务和知识库文件不会因此被删除。重新加载后如果问题仍然出现，
          可以先切换到其他模块继续工作。
        </p>
        <button type="button" onClick={this.reload}>重新加载工作站</button>
      </section>
    );
  }
}
