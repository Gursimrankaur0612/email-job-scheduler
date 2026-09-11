interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-400">{description}</p>}
    </div>
  );
}
