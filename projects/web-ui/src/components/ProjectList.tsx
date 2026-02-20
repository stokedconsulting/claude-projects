interface ProjectListProps {
  onBack: () => void;
}

export function ProjectList({ onBack }: ProjectListProps) {
  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="mb-4 text-sm text-github-text-muted hover:text-github-text transition-colors"
      >
        ← Back to Overview
      </button>
      <h2 className="text-xl font-semibold text-github-text mb-4">Project List</h2>
      <p className="text-github-text-muted text-sm">Projects will be listed here.</p>
    </div>
  );
}
