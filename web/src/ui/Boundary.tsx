import { Component, type ReactNode } from "react";

/** Catches a failed load below it and renders `fallback`; `retry` clears the error (after `onRetry`). */
export class Boundary extends Component<
  { children: ReactNode; fallback: (error: Error, retry: () => void) => ReactNode; onRetry?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  retry = () => { this.props.onRetry?.(); this.setState({ error: null }); };
  render() { return this.state.error ? this.props.fallback(this.state.error, this.retry) : this.props.children; }
}
