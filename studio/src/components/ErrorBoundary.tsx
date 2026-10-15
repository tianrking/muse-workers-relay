import { Component, type ErrorInfo, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Never log account state or credentials. */
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>工作空间暂时没有打开</h1>
          <p>
            请重新载入页面。未保存到本机的凭证需要重新导入，已有本机会话会保留。
          </p>
          <button className="primary" onClick={() => location.reload()}>
            重新载入
          </button>
        </main>
      );
    return this.props.children;
  }
}
