interface EmptyStateProps {
  title: string;
  body?: string;
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return <div className="community-hub-empty"><strong>{title}</strong>{body ? <p>{body}</p> : null}</div>;
}
