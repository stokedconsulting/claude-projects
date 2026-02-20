interface WorkspaceOverviewProps {
  onSelectWorkspace: (id: string) => void;
}

export function WorkspaceOverview({ onSelectWorkspace }: WorkspaceOverviewProps) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-github-text mb-4">Workspace Overview</h2>
      <p className="text-github-text-muted text-sm">Select a workspace to view its projects.</p>
      <button
        onClick={() => onSelectWorkspace('demo')}
        className="mt-4 px-4 py-2 bg-accent-blue text-white rounded text-sm hover:opacity-90 transition-opacity"
      >
        Open Demo Workspace
      </button>
    </div>
  );
}
