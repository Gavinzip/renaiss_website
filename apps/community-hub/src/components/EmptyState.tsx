import type { ReactNode } from "react";

interface EmptyStateProps {
  action?: ReactNode;
  title: string;
  body?: string;
}

export function EmptyState({ action, title, body }: EmptyStateProps) {
  return <div className="community-hub-empty"><strong>{title}</strong>{body ? <p>{body}</p> : null}{action ? <div className="community-hub-empty-action">{action}</div> : null}</div>;
}
